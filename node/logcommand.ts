//
// Command Format:
//    ##[group]name
//    ##[endgroup]
//    
// Examples:
//    ##[group]Available contexts
//    ##[endgroup]
//
let CMD_PREFIX = '##[';

export class LogCommand {
    constructor(command, name) {
        if (!command) {
            command = 'missing.command';
        }

        this.command = command;
        this.name = name;
    }

    public command: string;
    public name: string;

    public toString() {
        var cmdStr = CMD_PREFIX + this.command;

        cmdStr += ']';
        
        // safely append the name - avoid blowing up when attempting to
        // call .replace() if name is not a string for some reason
        let name: string = '' + (this.name || '');
        cmdStr += escapedata(name);

        return cmdStr;
    }
}

function escapedata(s) : string {
    return s.replace(/%/g, '%AZP25')
            .replace(/\r/g, '%0D')
            .replace(/\n/g, '%0A');
}

function unescapedata(s) : string {
    return s.replace(/%0D/g, '\r')
            .replace(/%0A/g, '\n')
            .replace(/%AZP25/g, '%');
}

function escape(s) : string {
    return s.replace(/%/g, '%AZP25')
            .replace(/\r/g, '%0D')
            .replace(/\n/g, '%0A')
            .replace(/]/g, '%5D')
            .replace(/;/g, '%3B');
}

function unescape(s) : string {
    return s.replace(/%0D/g, '\r')
            .replace(/%0A/g, '\n')
            .replace(/%5D/g, ']')
            .replace(/%3B/g, ';')
            .replace(/%AZP25/g, '%');
}
