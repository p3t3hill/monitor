// const helpers = require("./helpers");

type EmailOut = {
    subject: string;
    message: string;
    sent: boolean;
    added: Date;
    hash: string;
    sentAt: Date | null;
    sentBy: string;
};

exports.saveData = function (db: any, data: any) {
    db.collection(data.hostname).doc(new Date().toString()).set(data)
        .then(() => {
            // Done     
        })
        .catch((error: any) => {
            console.error("Error adding document: ", error);
        });
}

exports.saveEmail = function (db: any, email: any) {
    db.collection("Emails").doc(email.hash).set(email)
        .then(() => {
            // Done     
        })
        .catch((error: any) => {
            console.error("Error adding document: ", error);
        });
}

exports.queueEmail = async function (db: any, subject: any, message: any, from: string) {

    var dateObj = new Date();
    var month = dateObj.getUTCMonth() + 1; //months from 1-12
    var day = dateObj.getUTCDate();
    var year = dateObj.getUTCFullYear();
    var hour = dateObj.getUTCHours();
    var min = dateObj.getUTCMinutes();
    //console.log(subject + message + year + month + day + hour + min);
    
    var hash = hour + "_" + min + "_" + require("./helpers").hashString(subject + message + year + month + day + hour + min);
    var email = await getEmail(db, hash);
    // If email is undefined - needs to be sent
    //console.log('email', email);
    if (!email) {

        var emailOut: EmailOut;
        emailOut = { subject: subject, message: message, sent: false, added: new Date(), hash: hash, sentAt: null, sentBy: from };
        emailOut.message += "\n\n\n\n Queued by " + from + " at " + new Date();
        db.collection("Emails").doc(hash).set(emailOut)
            .then(() => {
                // Done     
            })
            .catch((error: any) => {
                console.error("Error adding document: ", error);
            });
    } else {
        console.log('Email already in DB');
    }
}

exports.saveValidator = function (db: any, validator: any, data: any) {
    db.collection('validators').doc(validator).set(data)
        .then(() => {
            // Done
        })
        .catch((error: any) => {
            console.error("Error updating validator: ", error);
        });
}

exports.setRestartRequired = function (db: any, validator: any, value: boolean) {
    db.collection('validators').doc(validator).update({"restartRequired": value})
        .then(() => {
            // Done
        })
        .catch((error: any) => {
            console.error("Error updating validator: ", error);
        });
}

export function deleteOldEmails(db: any) {
    // delete everything older than 24 hours
    var d = new Date();
    var count = 0;
    d.setHours(d.getHours() - 24);
    var olddata_query = db.collection("Emails").where('added', '<', d);
    olddata_query.get().then(function (querySnapshot: any) {
        querySnapshot.forEach(function (doc: any) {
            console.log('deleteemail', doc.data());
            if (doc.data().sent == true) {
                doc.ref.delete().then(() => {
                    count++;
                })
                    .catch((error: any) => {
                        console.error("Error deleteing Email document: ", error);
                    });
            }
        });
    });
    console.log(count + " old emails deleted")
}

export function deleteOldData(db: any, identifier: any) {
    // delete everything older than 2 hours
    var d = new Date();
    var count = 0;
    d.setHours(d.getHours() - 2);
    var olddata_query = db.collection(identifier).where('createdAt', '<', d);
    olddata_query.get().then(function (querySnapshot: any) {
        querySnapshot.forEach(function (doc: any) {
            doc.ref.delete().then(() => {
                count++;
            })
                .catch((error: any) => {
                    console.error("Error adding document: ", error);
                });
        });
    });
    console.log(count + " records deleted")
}

export async function getLatestData(db: any, identifier: any) {
    return new Promise<any>(res => {
        var data: any;
        var olddata_query = db.collection(identifier).orderBy('createdAt').limitToLast(1);
        olddata_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                data = doc.data();
            })
            res(data);
        }).catch((err: any) => {
            res(null);
        });
    });
};

export async function getFiveAgoData(db: any, identifier: any) {
    return new Promise<any>(res => {
        var data: any;
        var olddata_query = db.collection(identifier).orderBy('createdAt').limitToLast(5);
        olddata_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                data = doc.data();
                res(data);
            })
           
        }).catch((err: any) => {
            res(null);
        });
    });
};

export async function getEmail(db: any, hash: any) {
    return new Promise<any>(res => {
        var data: any;
        var email_query = db.collection("Emails").where('hash', '==', hash);
        email_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                data = doc.data();
            })
            res(data);
        }).catch((err: any) => {
            res(null);
        });
    });
};


export async function getValidator(db: any, identifier: any) {
    return new Promise<any>(res => {
        var data: any;
        var olddata_query = db.collection("validators").where('name', '==', identifier);
        olddata_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                data = doc.data();
            })
            res(data);
        }).catch((err: any) => {
            res(null);
        });
    });
};

export async function getValidators(db: any) {
    let arr: any[] = [];
    return new Promise<any>(res => {
        var data: any;
        var olddata_query = db.collection("validators").where('active', '!=', false);
        olddata_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                //console.log(1, doc.data());
                arr.push(doc.data());
                //console.log(1, arr);
            });
            res(arr);
        }).catch((err: any) => {
            res(null);
        });
    });

};

export async function getEmails(db: any) {
    let arr: any[] = [];
    return new Promise<any>(res => {
        var data: any;
        var email_query = db.collection("Emails").where('sent', '!=', true);
        email_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                //console.log(1, doc.data());
                arr.push(doc.data());
                //console.log(1, arr);
            });
            res(arr);
        }).catch((err: any) => {
            res(null);
        });
    });

};



export async function getLatestBlockFromDB(db: any, identifier: any) {
    return new Promise<number>(res => {
        var latestBlock = 0;
        var olddata_query = db.collection(identifier).orderBy('createdAt').limitToLast(1);
        olddata_query.get().then(function (querySnapshot: any) {
            querySnapshot.forEach(function (doc: any) {
                latestBlock = Number(doc.data().latestBlock);
            })
            res(latestBlock);
        }).catch((err: any) => {
            res(0);
        });

    });
}