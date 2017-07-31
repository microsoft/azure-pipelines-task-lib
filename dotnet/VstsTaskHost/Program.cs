using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Threading;

namespace VSTS
{
    public class TaskHost
    {
        private static CancellationTokenSource tokenSource = new CancellationTokenSource();
        private static string assemblyPath;
        private static string typeName;

        public static void Main(string[] args)
        {
            Console.CancelKeyPress += Console_CancelKeyPress;
            AssemblyLoadContext.Default.Resolving += ResolveAssembly;
            TaskLib taskContext = new TaskLib();
            taskContext.Initialize();
            try
            {
                ArgUtil.NotNull(args, nameof(args));
                ArgUtil.Equal(2, args.Length, nameof(args.Length));

                assemblyPath = args[0];
                typeName = args[1];
                taskContext.Debug(assemblyPath);
                taskContext.Debug(typeName);

                ArgUtil.File(assemblyPath, nameof(assemblyPath));
                ArgUtil.NotNullOrEmpty(typeName, nameof(typeName));

                Assembly taskAssembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);
                ArgUtil.NotNull(taskAssembly, nameof(taskAssembly));

                Type type = taskAssembly.GetType(typeName, throwOnError: true);
                var vstsTask = Activator.CreateInstance(type) as ITask;
                ArgUtil.NotNull(vstsTask, nameof(vstsTask));

                vstsTask.RunAsync(taskContext, tokenSource.Token).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                if (ex.InnerException != null)
                {
                    taskContext.Debug(ex.InnerException.ToString());
                }

                taskContext.SetTaskResult("Failed", ex.ToString());
            }
            finally
            {
                AssemblyLoadContext.Default.Resolving -= ResolveAssembly;
                Console.CancelKeyPress -= Console_CancelKeyPress;
            }
        }

        private static Assembly ResolveAssembly(AssemblyLoadContext context, AssemblyName assembly)
        {
            string assemblyFilename = assembly.Name + ".dll";
            return context.LoadFromAssemblyPath(Path.Combine(Path.GetDirectoryName(assemblyPath), assemblyFilename));
        }

        private static void Console_CancelKeyPress(object sender, ConsoleCancelEventArgs e)
        {
            e.Cancel = true;
            tokenSource.Cancel();
        }
    }

    public static class ArgUtil
    {
        public static void Equal<T>(T expected, T actual, string name)
        {
            if (object.ReferenceEquals(expected, actual))
            {
                return;
            }

            if (object.ReferenceEquals(expected, null) ||
                !expected.Equals(actual))
            {
                throw new ArgumentOutOfRangeException(
                    paramName: name,
                    actualValue: actual,
                    message: $"{name} does not equal expected value. Expected '{expected}'. Actual '{actual}'.");
            }
        }

        public static void File(string fileName, string name)
        {
            ArgUtil.NotNullOrEmpty(fileName, name);
            if (!System.IO.File.Exists(fileName))
            {
                throw new FileNotFoundException(
                    message: $"File '{fileName}' not found",
                    fileName: fileName);
            }
        }

        public static void NotNull(object value, string name)
        {
            if (object.ReferenceEquals(value, null))
            {
                throw new ArgumentNullException(name);
            }
        }

        public static void NotNullOrEmpty(string value, string name)
        {
            if (string.IsNullOrEmpty(value))
            {
                throw new ArgumentNullException(name);
            }
        }
    }
}
