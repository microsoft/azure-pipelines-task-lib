using System.Threading;
using System.Threading.Tasks;

namespace ProcessInvoker
{
    // http://blogs.msdn.com/b/pfxteam/archive/2012/02/11/10266920.aspx
    public class AsyncManualResetEvent
    {
        private volatile TaskCompletionSource<bool> _tcs = new TaskCompletionSource<bool>();

        public Task WaitAsync() { return _tcs.Task; }

        public void Set()
        {
            TaskCompletionSource<bool> tcs = _tcs;
            Task.Factory.StartNew(
                action: (object s) => ((TaskCompletionSource<bool>)s).TrySetResult(true),
                state: tcs,
                cancellationToken: CancellationToken.None,
                creationOptions: TaskCreationOptions.PreferFairness,
                scheduler: TaskScheduler.Default);
            tcs.Task.Wait();
        }

        public void Reset()
        {
            while (true)
            {
                TaskCompletionSource<bool> tcs = _tcs;
                if (!tcs.Task.IsCompleted ||
                    Interlocked.CompareExchange(ref _tcs, new TaskCompletionSource<bool>(), tcs) == tcs)
                {
                    return;
                }
            }
        }
    }
}
