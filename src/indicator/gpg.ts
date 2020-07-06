import * as process from './process';
import * as tempfile from './tempfile';

export interface GpgKeyInfo {
    type: string;
    capabilities: string;
    fingerprint: string;
    keygrip: string;
}

/**
 * Parse lots GPG key information from gpg command
 *
 * @param {string} rawText output string from gpg --fingerprint --fingerprint --with-keygrip
 */
function parseGpgKey(rawText: string): Array<GpgKeyInfo> {
    let pattern: RegExp = /(pub|sub)\s+\w+.*\[(.)*\]\n((?:\s*\w+)*)\n\s+Keygrip\s=\s(\w+)/g;
    // group 1: pub or sub, 2: ability (E S C A), 3: fingerprint with spaces 4. keygrip

    let infos: Array<GpgKeyInfo> = [];
    let matched: RegExpExecArray | null;
    while ((matched = pattern.exec(rawText)) !== null) {
        let fingerprint = matched[3].replace(/\s+/g, '');
        let info = {
            type: matched[1],
            capabilities: matched[2],
            fingerprint: fingerprint,
            keygrip: matched[4],
        };
        infos.push(info);
    }

    return infos;
}


export async function isKeyUnlocked(keygrip: string): Promise<boolean> {
    let outputs = await process.textSpawn('gpg-connect-agent', [], `KEYINFO ${keygrip}`);

    let lines = outputs.split("\n");
    if (lines.length === 1) {
        throw new Error(lines[0]);
    }
    // second line is OK
    // Sample: S KEYINFO CB18328AD05158F97CC8F33682F7AD291F52CB08 D - - - P - - -
    let line = lines[0];
    let tokens = line.split(' ');
    if (tokens.length !== 11) {
        throw new Error('Fail to parse KEYINFO output');
    }

    let isUnlocked = tokens[6] === '1';
    return isUnlocked;
}

export async function isKeyIdUnlocked(keyId: string): Promise<boolean> {
    // --fingerprint flag is give twice to get fingerprint of subkey
    let keyInfoRaw: string = await process.textSpawn('gpg', ['--fingerprint', '--fingerprint', '--with-keygrip'], '');
    let infos = parseGpgKey(keyInfoRaw);

    for (let info of infos) {
        // GPG signing key is usually given as shorter ID
        if (info.fingerprint.includes(keyId)) {
            return isKeyUnlocked(info.keygrip);
        }
    }

    throw new Error(`Can not find key with ID: ${keyId}`);
}

export async function getKeyInfo(keyId: string): Promise<GpgKeyInfo> {
    // --fingerprint flag is give twice to get fingerprint of subkey
    let keyInfoRaw: string = await process.textSpawn('gpg', ['--fingerprint', '--fingerprint', '--with-keygrip'], '');
    let infos = parseGpgKey(keyInfoRaw);

    for (let info of infos) {
        // GPG signing key is usually given as shorter ID
        if (info.fingerprint.includes(keyId)) {
            return info;
        }
    }

    throw new Error(`Can not find key with ID: ${keyId}`);
}

class Action {
    readonly question: RegExp;
    readonly answer: string;

    constructor(question: RegExp, answer: string) {
        this.question = question;
        this.answer = answer;
    }
}

async function answerTty(tty: process.Tty, actions: Action[]): Promise<void> {
    for (const action of actions) {
        const output = await tty.read();
        if (output.match(action.question) === null) { throw new Error('Fail to match output'); }
        await tty.write(action.answer);
    }
}

export async function unlockByKeyId(keyId: string, passphrase: string): Promise<void> {
    let document: tempfile.TempTextFile | undefined;
    let signature: tempfile.TempTextFile | undefined;

    try {
        document = new tempfile.TempTextFile();
        signature = new tempfile.TempTextFile();
        await document.create();
        await signature.create();

        const actions = [
            new Action(/File .* exists. Overwrite\? \(y\/N\)/, 'y\n'),
            new Action(/Enter passphrase:/, passphrase + '\n'),
        ];

        await process.expectPty(
            'gpg',
            [
                '--clear-sign', '--pinentry-mode', 'loopback', '--local-user', keyId,
                '--output', signature.filePath, document.filePath,
            ],
            actions
        );
    } finally {
        signature?.dispose();
        document?.dispose();
    }
    // gpg can signed the document even if the document is empty

}
