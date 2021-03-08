/**
 * IDEncrypter allows to encrypt and decrypt a bigint using the aes-128-ctr 
 * and complemented with some checksum validations:
 * - one checksum included inside the encrypted data
 * - a second one public, at the end of the returned string
 * 
 * IDEncrypter returns a URL-safe base64-like string of 16 chars; that string
 * is composed of the chars: [A-Za-z0-9] - _ .
 * The last two chars represent a public checksum that you can validate using the
 * function isValidEncryptedID. If you copy the functions isValidEncryptedID and 
 * checksumString outside of this file, you can use them in the user interface side.
 * 
 * IDEncrypter constructor requires two strings of 16 chars of [A-Za-z0-9]. 
 * These strings work as a template for the passwords required during the encrypting 
 * process. These strings are shuffles in order to generate very different encrypted 
 * id even when they are sequential.
 * 
 * For example, for: new IDEncrypter('3zTvzr3p67VC61jm', '60iP0h6vJoEaJo8c')
 * There are listed some numbers with the encrypted correspondent value:
 * 
 *                   ID     Encrypted ID
 *                   1n uftSdCUhUTBQ0111
 *                   2n dmY1mZ8zdxsw0210
 *                   3n RYG2E7kLCEQh030b
 *                   4n YAuzxMU1mdYn0408
 *                   5n BQjHWTD6_ulK0507
 *                   6n J_BFtuk1cz1D0609
 *                   7n EHT8AO2zDvi0070d
 *                   8n pd3iGJLINuEC0811
 *                   9n Q3qCqYo7hGUP0909
 *                  10n uftSdCUhUTtQ010d
 *             1678954n VoQvLVEEAyqk280b
 *             1678955n LLdjjJzrxIEc2909
 *             1678956n w_EEBjsfTlWs2a0d
 *             1678957n hWIKAYeoyBhs2b11
 *             1678958n isfB5yGaL2Zy2c0a
 *             1678959n KPVmBdcpMaGq2d0b
 *             1678960n TP4jFWNGkf9M250c
 *             1678961n o4VoK2Eb2FMQ2608
 *             1678962n 5zI__UMdYO7d270c
 *             1678963n VoQvLVEEAzOk280e
 *             1678964n LLdjjJzrxJ4c290b
 * 9223372036854775707n bEG1TRHA6k0P5718
 * 9223372036854775708n jsh8ZwcIP43X5808
 * 9223372036854775709n atgiDIJ_-vcJ5910
 * 9223372036854775710n PloRFyQJQ2hI510c
 * 9223372036854775711n cLNdf2e01Q-U5209
 * 9223372036854775712n sw93YzZF-Exw5309
 * 9223372036854775713n H6UG5ukZZv9i5408
 * 9223372036854775714n caogdvGry6mN550c
 * 9223372036854775715n l-qteIF3fLyB560f
 * 9223372036854775716n bEG1TRHA6nIP5707
 * 
 * Be aware: If you try to order the encrypted password, you will not get 
 * the same order if you order the id.
 * 
 * IDEncrypter support int64/long numbers generating an encrypted string
 * of 16 chars; if you introduce numbers bigger than the maximum of int64 
 * (9_223_372_036_854_775_807) you will get encrypted string even longer.
 */

import * as crypto from "crypto";

const algorithm = 'aes-128-ctr'

const ENC: any = {
    '+': '-',
    '/': '_',
    '=': '.'
}
const DEC: any = {
    '-': '+',
    _: '/',
    '.': '='
}

export class IDEncrypter {
    readonly password: string
    readonly initializationVector: string

    /**
     * Create a new password encrypter
     * 
     * @param password Must be a string of 16 chars of [A-Za-z0-9]
     * @param initializationVector Must be a string of 16 chars of [A-Za-z0-9]
     */
    constructor(password: string, initializationVector: string) {
        this.password = password
        this.initializationVector = initializationVector
    }

    /**
     * Encrypt the ID and returns an URL-safe base64
     * 
     * @param id ID to encrypt
     */
    encrypt(id: bigint): string {
        let idHex = id.toString(16)
        if (idHex.length < 16) {
            idHex = '0'.repeat(16 - idHex.length) + idHex
        }
    
        const cs = checksumValue(id)
        let csHex = cs.toString(16)
        if (csHex.length < 2) {
            csHex = '0' + csHex
        }
    
        const hex = idHex + csHex
    
        const cipher = crypto.createCipheriv(algorithm, this.shufflePassword(cs), this.shuffleIV(cs))
        const buffer = Buffer.from(hex, 'hex')
        const encrypted = cipher.update(buffer)
        const final = cipher.final()
    
        // Transform to base64 url safe
        const result = Buffer.concat([encrypted, final]).toString('base64').replace(/[+/=]/g, c => ENC[c]) + csHex
        return result + checksumString(result)
    }
    
    /**
     * Decrypt an ID
     * 
     * @param encryptedID ID encrypted
     */
    decrypt(encryptedID: string) {
        let encrypted = encryptedID
        if (encrypted.length < 16) {
            throw new Error('Invalid id: ' + encryptedID)
        }
    
        const csString = encrypted.substring(encrypted.length - 2)
        encrypted = encrypted.substring(0, encrypted.length - 2)
        if (checksumString(encrypted) !== csString) {
            throw new Error('Invalid id: ' + encryptedID)
        }
    
        const pcsHex = encrypted.substring(encrypted.length - 2)
        const pcs = BigInt('0x' + pcsHex)
    
        encrypted = encrypted.substring(0, encrypted.length - 2)
        // Transform from base64 url safe
        encrypted = encrypted.replace(/[-_.]/g, c => DEC[c])
    
        const decipher = crypto.createDecipheriv(algorithm, this.shufflePassword(pcs), this.shuffleIV(pcs))
        const buffer = Buffer.from(encrypted, 'base64')
        const decrypted = decipher.update(buffer)
        const final = decipher.final();
    
        const hex = Buffer.concat([decrypted, final]).toString('hex')
        const icsHex = hex.substring(hex.length - 2)
        const idHex = hex.substring(0, hex.length - 2)
    
        const ics = BigInt('0x' + icsHex)
        const id = BigInt('0x' + idHex)
    
        const cs = checksumValue(id)
    
        if (ics !== cs || pcs !== cs) {
            throw new Error('Invalid id: ' + encryptedID)
        }
    
        return id
    }

    private shufflePassword(cs: bigint): string {
        const password = this.password
        const n = Number(cs) % password.length
        return password.substring(n) + password.substring(0, n)
    }
    
    private shuffleIV(cs: bigint): string {
        const iv = this.initializationVector
        const n = Math.floor(Number(cs) / iv.length)
        return iv.substring(n) + iv.substring(0, n)
    }
}

function checksumValue(value: bigint): bigint {
    let sum = 0n;

    while (value) {
        sum += value % 10n;
        value = value / 10n;
    }

    return sum % 256n
}

/*
 * If you copy the next functions to the user interface, you can validate if 
 * an encrypted id looks ok without decrypting it. This validation is useful 
 * if, for some reason, you need the user input the encrypted id, allowing cath 
 * wrong inputs from the user without sending the information to the server.
 */

function checksumString(value: string): string {
    let charSum = 0;

    for (let i = 0; i < value.length; i++) {
        charSum += value.charCodeAt(i)
    }

    let sum = 0;
    while (charSum) {
        sum += charSum % 10;
        charSum = Math.floor(charSum / 10);
    }

    let hex = (sum % 256).toString(16)
    if (hex.length < 2) {
        hex = '0' + hex
    }
    return hex
}

export function isValidEncryptedID(encryptedID: string): boolean {
    let encrypted = encryptedID
    if (encrypted.length < 16) {
        return false
    }

    const csString = encrypted.substring(encrypted.length - 2)
    encrypted = encrypted.substring(0, encrypted.length - 2)
    if (checksumString(encrypted) !== csString) {
        return false
    }

    return true
}