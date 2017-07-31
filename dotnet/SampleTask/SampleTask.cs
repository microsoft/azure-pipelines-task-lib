using System;
using System.Threading;
using System.Threading.Tasks;
using VSTS;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;
using Microsoft.VisualStudio.Services.OAuth;
using Microsoft.TeamFoundation.Build.WebApi;
using System.IO;

namespace SampleTask
{
    public class SampleTask : ITask
    {
        public async Task RunAsync(TaskLib taskContext, CancellationToken token)
        {
            try
            {
                string projectId = taskContext.GetVariable("System.TeamProjectId");
                string artifactName = taskContext.GetInput("artifactName");
                string downloadPath = taskContext.GetPathInput("downloadPath");
                int buildId = Int32.Parse(taskContext.GetInput("buildId"));

                string collectionUrl = taskContext.GetEndpointUrl("SYSTEMVSSCONNECTION");
                string accessToken = taskContext.GetEndpointAuthorizationParameter("SYSTEMVSSCONNECTION", "AccessToken");

                VssCredentials creds = new VssCredentials(null, new VssOAuthAccessTokenCredential(accessToken), CredentialPromptType.DoNotPrompt);
                VssConnection connection = new VssConnection(new Uri(collectionUrl), creds);
                var buildClient = await connection.GetClientAsync<BuildHttpClient>();
                var artifact = await buildClient.GetArtifactAsync(projectId, buildId, artifactName);

                using (Stream zip = await buildClient.GetArtifactContentZipAsync(projectId, buildId, artifactName))
                {
                    using (FileStream fs = File.Open(Path.Combine(downloadPath, $"{Guid.NewGuid()}.zip"), FileMode.Create, FileAccess.Write))
                    {
                        await zip.CopyToAsync(fs);
                    }
                }
            }
            catch (Exception ex)
            {
                taskContext.SetTaskResult("Failed", ex.ToString());
            }
        }
    }
}
