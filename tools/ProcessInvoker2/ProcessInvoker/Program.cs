using System;
using System.Collections.Generic;
using System.IO.Pipes;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Globalization;
using System.Collections.Concurrent;
using System.Threading;
using System.Diagnostics;

namespace ProcessInvoker
{
    // This program translates the output from tools to UTF8. Node has limited built-in
    // support for encodings.
    //
    // This program supports translating from either the default console-output code page
    // or the system default code page. Both vary depending on the locale configuration.
    //
    // Note, on a typical en-US box, testing with the 'ç' character is a good way to
    // determine whether data is passed correctly between processes. This is because
    // the 'ç' character has a different code point across each of the common encodings
    // on a typical en-US box, i.e.
    //   1) the default console-output code page (IBM437)
    //   2) the system default code page (i.e. CP_ACP) (Windows-1252)
    //   3) UTF8
    public static class Program
    {
        private const string c_consoleOutputEncoding = "ConsoleOutput";
        private const string c_systemDefaultEncoding = "SystemDefault";
        private static readonly AsyncManualResetEvent s_outputProcessEvent = new AsyncManualResetEvent();
        private static readonly TaskCompletionSource<bool> s_processExitedCompletionSource = new TaskCompletionSource<bool>();
        private static readonly ConcurrentQueue<string> s_errorData = new ConcurrentQueue<string>();
        private static readonly ConcurrentQueue<string> s_outputData = new ConcurrentQueue<string>();
        private static volatile int s_asyncStreamReaderCount = 2;
        private static volatile bool s_waitingOnStreams = false;

        public static int Main(string[] args)
        {
            // Setup the out pipe.
            string outPipeHandle = Environment.GetEnvironmentVariable("VSTS_PROCESS_INVOKER_PIPE_HANDLE");
            using (var outPipe = new AnonymousPipeClientStream(PipeDirection.Out, outPipeHandle))
            using (var outPipeWriter = new StreamWriter(outPipe, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)))
            {
                try
                {
                    // Get the inputs.
                    string fileName = GetString("VSTS_PROCESS_INVOKER_FILE_NAME", assert: true);
                    string arguments = GetString("VSTS_PROCESS_INVOKER_ARGUMENTS");
                    string workingDirectory = GetString("VSTS_PROCESS_INVOKER_WORKING_DIRECTORY");
                    Encoding fromEncoding = GetEncoding("VSTS_PROCESS_INVOKER_ARGUMENTS_FROM_ENCODING");

                    // Redefine the writer over stdout to use UTF8. Node expects UTF8 by default.
                    Stream stdout = Console.OpenStandardOutput();
                    var stdoutWriter = new StreamWriter(stdout, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
                    Console.SetOut(stdoutWriter);

                    // Invoke the target process.
                    int exitCode = Invoke(
                        fileName: fileName,
                        arguments: arguments,
                        workingDirectory: workingDirectory,
                        encoding: fromEncoding);

                    // Write the exit code to the out pipe.
                    string resultJson = string.Format(CultureInfo.InvariantCulture, "{{ \"ExitCode\": {0} }}", exitCode);
                    outPipeWriter.WriteLine(resultJson);

                    // Infrastructure succeeded.
                    return 0;
                }
                catch (Exception ex)
                {
                    // Infrastructure failed.
                    outPipeWriter.WriteLine(ex.ToString());
                    return 1;
                }
            }
        }

        private static Encoding GetEncoding(string name)
        {
            string str = GetString(name, assert: true);
            switch (str)
            {
                case c_consoleOutputEncoding:
                    return Console.OutputEncoding;
                case c_systemDefaultEncoding:
                    return Encoding.Default;
                default:
                    throw new ArgumentException($"Unable to convert '{name}' to an encoding. Unexpected value '{str}'. Expected '{c_consoleOutputEncoding}' or '{c_systemDefaultEncoding}'.");
            }
        }

        private static string GetString(string name, bool assert = false)
        {
            string val = Environment.GetEnvironmentVariable(name);
            if (assert && string.IsNullOrEmpty(val))
            {
                throw new ArgumentNullException(paramName: name, message: $"Variable '{name}' cannot be null or empty.");
            }

            return val;
        }

        private static int Invoke(
            string fileName,
            string arguments,
            string workingDirectory,
            Encoding encoding)
        {
            using (Process process = new Process())
            {
                process.StartInfo.FileName = fileName;
                process.StartInfo.Arguments = arguments;
                process.StartInfo.WorkingDirectory = workingDirectory;
                process.StartInfo.UseShellExecute = false;
                process.StartInfo.CreateNoWindow = true;
                process.StartInfo.RedirectStandardInput = true;
                process.StartInfo.RedirectStandardError = true;
                process.StartInfo.RedirectStandardOutput = true;
                process.StartInfo.StandardErrorEncoding = encoding;
                process.StartInfo.StandardOutputEncoding = encoding;

                // Hook up the events.
                process.EnableRaisingEvents = true;
                process.Exited += ProcessExitedHandler;

                // Start the process.
                process.Start();

                // Close the input stream. This is done to prevent commands from blocking the build waiting for input from the user.
                process.StandardInput.Dispose();

                // Start the standard error notifications, if appropriate.
                StartReadStream(process.StandardError, s_errorData);

                // Start the standard output notifications, if appropriate.
                StartReadStream(process.StandardOutput, s_outputData);

                while (true)
                {
                    Task outputSignal = s_outputProcessEvent.WaitAsync();
                    Task signaled = Task.WhenAny(outputSignal, s_processExitedCompletionSource.Task).GetAwaiter().GetResult();
                    if (signaled == outputSignal)
                    {
                        ProcessOutput();
                    }
                    else
                    {
                        break;
                    }
                }

                // Just in case there was some pending output when the process shut down go ahead and check the
                // data buffers one last time before returning
                ProcessOutput();

                return process.ExitCode;
            }
        }

        private static void ProcessOutput()
        {
            List<string> errorData = new List<string>();
            List<string> outputData = new List<string>();

            string errorLine;
            while (s_errorData.TryDequeue(out errorLine))
            {
                errorData.Add(errorLine);
            }

            string outputLine;
            while (s_outputData.TryDequeue(out outputLine))
            {
                outputData.Add(outputLine);
            }

            s_outputProcessEvent.Reset();

            // Write the error lines.
            if (errorData != null)
            {
                foreach (string line in errorData)
                {
                    if (line != null)
                    {
                        Console.Error.WriteLine(line);
                    }
                }
            }

            // Process the output lines.
            if (outputData != null)
            {
                foreach (string line in outputData)
                {
                    if (line != null)
                    {
                        Console.WriteLine(line);
                    }
                }
            }
        }

        private static void ProcessExitedHandler(object sender, EventArgs e)
        {
            if (s_asyncStreamReaderCount != 0)
            {
                s_waitingOnStreams = true;
                Task.Run(async () =>
                {
                    // Wait 5 seconds and then Cancel/Kill process tree
                    await Task.Delay(TimeSpan.FromSeconds(5));
                    // Todo: KillProcessTree?
                    s_processExitedCompletionSource.TrySetResult(true);
                });
            }
            else
            {
                s_processExitedCompletionSource.TrySetResult(true);
            }
        }

        private static void StartReadStream(StreamReader reader, ConcurrentQueue<string> dataBuffer)
        {
            Task.Run(() =>
            {
                while (!reader.EndOfStream)
                {
                    string line = reader.ReadLine();
                    if (line != null)
                    {
                        dataBuffer.Enqueue(line);
                        s_outputProcessEvent.Set();
                    }
                }

                if (Interlocked.Decrement(ref s_asyncStreamReaderCount) == 0 && s_waitingOnStreams)
                {
                    s_processExitedCompletionSource.TrySetResult(true);
                }
            });
        }
    }
}
