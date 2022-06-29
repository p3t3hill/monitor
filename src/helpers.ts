import { Config } from "./config";
import fs from 'fs';

const { exec } = require("child_process");

let config: Config = require('../config.json');

const nodemailer = require('nodemailer');
const checkDiskSpace = require('check-disk-space');
const os = require("os");
let mailTransporter: any = null;

export function setUpEMail() {
    if (mailTransporter == null) {
        mailTransporter = nodemailer.createTransport({
            pool: true,
            maxConnections: 1,
            host: config.emailHost,
            port: config.emailPort,
            // secure: false, // upgrade later with STARTTLS
            auth: {
                user: config.emailUser,
                pass: config.emailPass
            }
        });
    }
}

//exports.sendEmail = function (subject: string, message: string) {
export async function sendTheEmail(subject: string, message: string) {
    return new Promise<boolean>(res => {
        var mailOptions = {
            from: 'validator@petehill.co.uk',
            to: 'p3te.hill@gmail.com',
            subject: subject,
            text: message
        };
        mailTransporter.sendMail(mailOptions, function (error: any, info: any) {
            if (error) {
                console.log(error);
                mailTransporter = null;
                setUpEMail();
                res(false);
            } else {
                console.log('Email sent: ' + info.response);
                res(true);
            }
        });
    });
}


export async function getDiskSpace() {
    return new Promise<number>(res => {
        checkDiskSpace('/dev/mapper/ubuntu--vg-ubuntu--lv').then((diskSpace: any) => {
            res(((diskSpace.size - diskSpace.free) / diskSpace.size) * 100);
        }).catch((err: any) => {
            res(0);
        });
    });
}

export function getSystemInfo() {
    var hostname = os.hostname();
    const nets = os.networkInterfaces();
    var ip = "";
    // Take the first address - assumes server has only 1 address
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                ip = net.address;
            }
        }
    }
    return { hostname: hostname, ip: ip };
}

exports.hashString = function (stringToHash: any) {
    return require('crypto').createHash('md5').update(stringToHash).digest("hex");
}

function setupData(os: any): { hostname: any; createdAt: Date; latestBlock: number; diskSpaceUsedPercent: number; info: string; ip: string; processed: number; } {

    var hostname = os.hostname();
    const nets = os.networkInterfaces();
    var ip = "";
    // Take the first address - assumes server has only 1 address
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                ip = net.address;
            }
        }
    }
    return { hostname: hostname, createdAt: new Date(), latestBlock: 0, diskSpaceUsedPercent: 0, info: '', ip: ip, processed: 0 };
}

export async function delay(ms: any) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function roundToTwo(num: number) {
    return Math.round(num * 100 + Number.EPSILON) / 100
}


export async function updateMonitor() {
    return new Promise<number>(res => {
        exec("/home/pete/monitor/update.sh", (error: any, stderr: any, stdout: any) => {
            if (error) {
                console.log(`error: ${error.message}`);
                res(0);
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                res(0);
            }
            try {
                res(JSON.parse(stdout).SyncInfo.latest_block_height);
            } catch (e) {
                console.log(`err: ${e}`);
                res(0);
            }
        });
    });
}

export function fileExists(path: string) {
    return fs.existsSync(path);
}


