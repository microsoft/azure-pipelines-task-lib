using System;
using System.Threading;
using System.Threading.Tasks;

namespace VSTS
{
    public interface ITask
    {
        Task RunAsync(CancellationToken token);
    }

    public static class TaskLib
    {
    }
}
