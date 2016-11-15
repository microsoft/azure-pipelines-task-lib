function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   exit 1
}

../node_modules/.bin/tsc || failed 'Compilation failed.'
../_download/archive/https___nodejs.org_dist_v5.10.1_node-v5.10.1-darwin-x64.tar.gz/node-v5.10.1-darwin-x64/bin/node gendocs.js