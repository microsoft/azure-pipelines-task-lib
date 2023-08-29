declare module NodeJS {
    interface Global {
      _vsts_task_lib_loaded?: boolean;
      // proxy related
      _vsts_task_lib_proxy_url?: string;
      _vsts_task_lib_proxy_username?: string;
      _vsts_task_lib_proxy_bypass?: string;
      _vsts_task_lib_proxy_password?: string;
      _vsts_task_lib_proxy?: boolean;
      // cert related
      _vsts_task_lib_cert_ca?: string;
      _vsts_task_lib_cert_clientcert?: string;
      _vsts_task_lib_cert_key?: string;
      _vsts_task_lib_cert_archive?: string;
      _vsts_task_lib_cert_archiveFile?: string;
      _vsts_task_lib_cert_passphrase?: string;
      _vsts_task_lib_cert?: boolean;
      _vsts_task_lib_skip_cert_validation?: boolean;
    }
  }