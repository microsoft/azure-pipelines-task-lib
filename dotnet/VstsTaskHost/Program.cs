using System;
using System.Linq;
using System.Threading;

namespace VSTS
{
    public class TaskHost
    {
        private static CancellationTokenSource tokenSource = new CancellationTokenSource();

        public static int Main(string[] args)
        {
            try
            {
                Console.CancelKeyPress += delegate (object sender, ConsoleCancelEventArgs e)
                {
                    e.Cancel = true;
                    tokenSource.Cancel();
                };

                ArgUtil.NotNull(args, nameof(args));

                string assemblyQualifiedName = args.FirstOrDefault();
                ArgUtil.NotNullOrEmpty(assemblyQualifiedName, nameof(assemblyQualifiedName));

                Type type = Type.GetType(assemblyQualifiedName, throwOnError: true);
                var vstsTask = Activator.CreateInstance(type) as ITask;
                ArgUtil.NotNull(vstsTask, nameof(vstsTask));

                vstsTask.RunAsync(tokenSource.Token).GetAwaiter().GetResult();

                return 0;
            }
            catch (Exception ex)
            {
                TaskLib
                return 1;
            }
        }
    }

    public static class ArgUtil
    {
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
