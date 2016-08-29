using Microsoft.VisualStudio.Services.Agent.Util;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

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
        private static readonly string c_consoleOutputEncoding = "ConsoleOutput";
        private static readonly string c_systemDefaultEncoding = "SystemDefault";
        private static AnonymousPipeClientStream s_outPipe;

        public static int Main(string[] args)
        {
            string fileName = GetVariable("VSTS_PROCESS_INVOKER_FILE_NAME", assert: true);
            string arguments = GetVariable("VSTS_PROCESS_INVOKER_ARGUMENTS");
            string workingDirectory = GetVariable("VSTS_PROCESS_INVOKER_WORKING_DIRECTORY");
            string fromEncodingString = GetVariable("VSTS_PROCESS_INVOKER_ARGUMENTS_FROM_ENCODING", assert: true);
            Encoding fromEncoding;
            switch (toEncodingString)
            {
                case c_consoleOutputEncoding:
                    fromEncoding = Console.OutputEncoding;
                case c_systemDefaultEncoding:
                    fromEncoding = Encoding.DefaultEncoding;
                default:
                    throw new ArgumentException($"Unexpected value '{fromEncodingString}' for variable '{VSTS_PROCESS_INVOKER_ARGUMENTS_FROM_ENCODING}'.");
            }

            string outPipeName = Environment.GetEnvironmentVariable("VSTS_PROCESS_INVOKER_OUT_PIPE_NAME");
            s_outPipe = new AnonymousPipeClientStream(PipeDirection.Out, pipeNameOutput);
        }
    }

    private static string GetEncoding(string, )

    private static string GetString(string name, bool assert)
    {
        string val = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrEmpty(val))
        {
            throw new ArgumentNullException(paramName: name, message: $"Variable '{name}' cannot be null or empty.");
        }
    }

    private int InvokeProcess(
        string fileName,
        string arguments,
        string workingDirectory,
        Encoding fromEncoding,
        Encoding toEncoding)
    {
        //
    }

    // The implementation of the process invoker does not hook up DataReceivedEvent and ErrorReceivedEvent of Process,
    // instead, we read both STDOUT and STDERR stream manually on seperate thread.
    // The reason is we find a huge perf issue about process STDOUT/STDERR with those events.
    //
    // Missing functionalities:
    //       1. Cancel/Kill process tree
    //       2. Make sure STDOUT and STDERR not process out of order
    public sealed class ProcessInvoker : AgentService, IProcessInvoker
    {
        private Process _proc;
        private int _asyncStreamReaderCount = 2;
        private bool _waitingOnStreams = false;
        private readonly AsyncManualResetEvent _outputProcessEvent = new AsyncManualResetEvent();
        private readonly TaskCompletionSource<bool> _processExitedCompletionSource = new TaskCompletionSource<bool>();
        private readonly ConcurrentQueue<string> _errorData = new ConcurrentQueue<string>();
        private readonly ConcurrentQueue<string> _outputData = new ConcurrentQueue<string>();
        private readonly TimeSpan _sigintTimeout = TimeSpan.FromSeconds(10);
        private readonly TimeSpan _sigtermTimeout = TimeSpan.FromSeconds(5);

        public event EventHandler<ProcessDataReceivedEventArgs> OutputDataReceived;
        public event EventHandler<ProcessDataReceivedEventArgs> ErrorDataReceived;

        public async Task<int> ExecuteAsync(
            string workingDirectory,
            string fileName,
            string arguments,
            IDictionary<string, string> environment,
            bool requireExitCodeZero,
            Encoding outputEncoding,
            CancellationToken cancellationToken)
        {
            _proc = new Process();
            _proc.StartInfo.FileName = fileName;
            _proc.StartInfo.Arguments = arguments;
            _proc.StartInfo.WorkingDirectory = workingDirectory;
            _proc.StartInfo.UseShellExecute = false;
            _proc.StartInfo.CreateNoWindow = true;
            _proc.StartInfo.RedirectStandardInput = true;
            _proc.StartInfo.RedirectStandardError = true;
            _proc.StartInfo.RedirectStandardOutput = true;
            _proc.StartInfo.StandardErrorEncoding = toEncoding;
            _proc.StartInfo.StandardOutputEncoding = toEncoding;

            // Hook up the events.
            _proc.EnableRaisingEvents = true;
            _proc.Exited += ProcessExitedHandler;

            // Start the process.
            _stopWatch = Stopwatch.StartNew();
            _proc.Start();

            // Close the input stream. This is done to prevent commands from blocking the build waiting for input from the user.
            _proc.StandardInput.Dispose();

            // Start the standard error notifications, if appropriate.
            StartReadStream(_proc.StandardError, _errorData);

            // Start the standard output notifications, if appropriate.
            StartReadStream(_proc.StandardOutput, _outputData);

            while (true)
            {
                Task outputSignal = _outputProcessEvent.WaitAsync();
                var signaled = await Task.WhenAny(outputSignal, _processExitedCompletionSource.Task);

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

            return _proc.ExitCode;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        private void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_proc != null)
                {
                    _proc.Dispose();
                    _proc = null;
                }
            }
        }

        private void ProcessOutput()
        {
            List<string> errorData = new List<string>();
            List<string> outputData = new List<string>();

            string errorLine;
            while (_errorData.TryDequeue(out errorLine))
            {
                errorData.Add(errorLine);
            }

            string outputLine;
            while (_outputData.TryDequeue(out outputLine))
            {
                outputData.Add(outputLine);
            }

            _outputProcessEvent.Reset();

            // Write the error lines.
            if (errorData != null && this.ErrorDataReceived != null)
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
            if (outputData != null && this.OutputDataReceived != null)
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

        private void ProcessExitedHandler(object sender, EventArgs e)
        {
            if (_asyncStreamReaderCount != 0)
            {
                _waitingOnStreams = true;

                Task.Run(async () =>
                {
                    // Wait 5 seconds and then Cancel/Kill process tree
                    await Task.Delay(TimeSpan.FromSeconds(5));
                    // Todo: KillProcessTree?
                    _processExitedCompletionSource.TrySetResult(true);
                });
            }
            else
            {
                _processExitedCompletionSource.TrySetResult(true);
            }
        }

        private void StartReadStream(StreamReader reader, ConcurrentQueue<string> dataBuffer)
        {
            Task.Run(() =>
            {
                while (!reader.EndOfStream)
                {
                    string line = reader.ReadLine();
                    if (line != null)
                    {
                        dataBuffer.Enqueue(line);
                        _outputProcessEvent.Set();
                    }
                }

                if (Interlocked.Decrement(ref _asyncStreamReaderCount) == 0 && _waitingOnStreams)
                {
                    _processExitedCompletionSource.TrySetResult(true);
                }
            });
        }
    }

    public sealed class ProcessExitCodeException : Exception
    {
        public int ExitCode { get; private set; }

        public ProcessExitCodeException(int exitCode, string fileName, string arguments)
            : base(StringUtil.Loc("ProcessExitCode", exitCode, fileName, arguments))
        {
            ExitCode = exitCode;
        }
    }
}
