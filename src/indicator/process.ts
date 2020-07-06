
import * as child from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as pty from 'node-pty';


export function sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Run specified command, with given input and return output(promise) in string
 *
 * @param command executable name
 * @param args options and arguments, executable name is not included
 * @param input stdin
 * @returns The promise which resolve the stdout. Rejects if fail to run command or command returns not zero value.
 */
export function textSpawn(command: string, args: Array<string>, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let proc = child.spawn(command, args);

        proc.stdin.on('error', reject);
        proc.stdin.write(input, 'utf8');
        proc.stdin.end();

        // setEncoding to force 'data' event returns string
        // see: https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding
        let output: string;
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => {
            output = data;
        });
        proc.stderr.setEncoding('utf8');
        let error_message: string;
        proc.stderr.on('data', (data) => {
            error_message = data;
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} failed, return code: ${code}, stderr: ${error_message}`));
            }
            resolve(output);
        });
    });
}

class Action {
    readonly question: RegExp;
    readonly answer: string;

    constructor(question: RegExp, answer: string) {
        this.question = question;
        this.answer = answer;
    }
}

export function expectPty(command: string, args: Array<string>, actions: Action[]): Promise<void> {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    return new Promise((resolve, reject) => {
        let proc = pty.spawn(command, args, {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
        });

        proc.on('data', (data: string) => {
            const action = actions.shift();
            if (action === undefined) {
                reject(new Error('No enough action for current process'));
                return;
            }
            if (data.match(action.question) === null) {
                reject(new Error('Fail to match output'));
            }
            proc.write(action.answer);
        });

        proc.on('exit', (exitCode: number) => {
            if (exitCode !== 0) { reject(new Error(`Process [${command}] return [${exitCode}]`)); }
            else { resolve(); }
        });
    });

}


export interface Tty {
    read(): Promise<string>
    write(content: string): Promise<void>
}

export class CurrentTty implements Tty {
    #ttyPath?: string;
    #ttyHandle?: fs.promises.FileHandle;

    constructor() {
    }

    async open(): Promise<void> {
        const ttyOutput = await textSpawn('tty', [], '');
        this.#ttyPath = ttyOutput.replace('\n', '');
        this.#ttyHandle = await fs.promises.open(this.#ttyPath, 'rw');
    }

    async read(): Promise<string> {
        if (this.#ttyHandle === undefined) { throw new Error('TTY not opened'); }
        return await this.#ttyHandle.readFile('utf8');
    }

    async write(content: string): Promise<void> {
        if (this.#ttyHandle === undefined) { throw new Error('TTY not opened'); }
        await this.#ttyHandle.writeFile(content, 'utf8');
    }

    async dispose(): Promise<void> {
        await this.#ttyHandle?.close();
    }
}
