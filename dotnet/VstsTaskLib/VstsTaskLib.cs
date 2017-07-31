using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace VSTS
{
    public interface ITask
    {
        Task RunAsync(TaskLib taskContext, CancellationToken token);
    }

    public class TaskLib
    {
        public void Initialize()
        {
            Console.WriteLine("Initialize");
            foreach(DictionaryEntry env in Environment.GetEnvironmentVariables())
            {
                Debug($"{env.Key} = {env.Value}");
            }
        }

        public string GetVariable(string name)
        {
            string value = Environment.GetEnvironmentVariable(name.Replace(".", "_").ToUpperInvariant()) ?? string.Empty;
            Debug($"{name} = {value}");
            return value;
        }

        public string GetInput(string input)
        {
            string value = Environment.GetEnvironmentVariable($"INPUT_{input.Replace(" ", "_").ToUpperInvariant()}") ?? string.Empty;
            value = value.Trim();
            Debug($"{input} = {value}");
            return value;
        }

        public string GetPathInput(string input)
        {
            string value = GetInput(input);
            return value;
        }

        public string GetEndpointUrl(string id)
        {
            string value = Environment.GetEnvironmentVariable($"ENDPOINT_URL_{id}") ?? string.Empty;
            Debug($"{id} = {value}");
            return value;
        }

        public string GetEndpointAuthorizationParameter(string id, string key)
        {
            string authParam = Environment.GetEnvironmentVariable($"ENDPOINT_AUTH_PARAMETER_{id}_{key.ToUpperInvariant()}") ?? string.Empty;
            Debug($"{id} auth param {key} = {authParam}");
            return authParam;
        }

        public void Debug(string message)
        {
            WriteLoggingCommand("task", "debug", message);
        }

        public void AddTaskAttachment(string attachmentType, string attachmentName, string filePath)
        {
            WriteLoggingCommand("task", "addattachment", filePath, new Dictionary<string, string>() { { "type", attachmentType }, { "name", attachmentName } });
        }

        public void SetTaskResult(string result, string message)
        {
            if (result.Equals("failed", StringComparison.OrdinalIgnoreCase))
            {
                WriteLoggingCommand("task", "issue", message, new Dictionary<string, string>() { { "type", "error" } });
            }

            WriteLoggingCommand("task", "complete", string.Empty, new Dictionary<string, string>() { { "result", result } });
        }

        private void WriteLoggingCommand(string area, string command, string data = null, Dictionary<string, string> properties = null)
        {
            StringBuilder propertiesPart = new StringBuilder();
            propertiesPart.Append(" ");
            if (properties != null)
            {
                foreach (var prop in properties)
                {
                    propertiesPart.Append($"{prop.Key}={EscapeLoggingCommandStr(prop.Value)};");
                }
            }

            string loggingCommand = $"##vso[{area}.{command}{propertiesPart.ToString().TrimEnd()}]{EscapeLoggingCommandStr(data)}";

            Console.WriteLine(loggingCommand);
        }

        private string EscapeLoggingCommandStr(string input)
        {
            if (string.IsNullOrEmpty(input))
            {
                return string.Empty;
            }

            Dictionary<char, string> escapeMapping = new Dictionary<char, string>()
            {
                {';', "%3B"},
                {']', "%5D"},
                {'\r', "%0D"},
                {'\n', "%0A"},
            };

            StringBuilder escapedResult = new StringBuilder();
            foreach (char c in input)
            {
                if (escapeMapping.ContainsKey(c))
                {
                    escapedResult.Append(escapeMapping[c]);
                }
                else
                {
                    escapedResult.Append(c);
                }
            }

            return escapedResult.ToString();
        }
    }
}
