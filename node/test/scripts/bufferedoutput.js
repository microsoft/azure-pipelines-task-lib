var os = require('os');
var stdout = process.stdout;
var stderr = process.stderr;

stdout.write('stdline 1' + os.EOL, function () {
    stdout.write('stdline 2', function () {
        stdout.write(os.EOL + 'stdline 3');
    });
});

stderr.write('errline 1' + os.EOL, function () {
    stderr.write('errline 2', function () {
        stderr.write(os.EOL + 'errline 3');
    });
});
