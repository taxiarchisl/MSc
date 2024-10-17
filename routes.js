const express = require('express');
const app = express();
const session = require('express-session');
const path = require('path');
var bodyParser = require('body-parser');
const db = require('./static/customLibs/db');
const mail = require('./static/customLibs/mail');
const hlp = require('./static/customLibs/helper');
const requestIp = require('request-ip');
const uuid = require('custom-uuid');
require('dotenv').config();
const { Web3 } = require('web3');
const web3 = new Web3(process.env.BC_NETWORK_ADDRESS);
const ABI = require('./AppContract/build/contracts/MyElections.json').abi;

//Functions
async function fetchGasPrice(type, sender) {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        if (type == 'raw') return gasPrice;
        var inEth = Number(gasPrice) / 100000000000000 / 10000;
        return inEth.toFixed(10);

    } catch (error) {
        console.error(`Failed to get gas price due to an error: ${error}`);

        // Fallback to a default gas price if the fetch fails.
        const defaultGasPrice = web3.utils.toWei('50', 'gwei');
        var inEth = Number(defaultGasPrice) / 100000000000000 / 10000;
        return inEth.toFixed(10);
    }
};

async function getBalance(address, block) {
    const balance = await web3.eth.getBalance(address, block);
    var inEth = Number(balance) / 100000000000000 / 10000;
    return inEth;
};



async function getAllInputs(startBlockNumber, endBlockNumber) {
    transactions = [];
    transInputs = [];
    startBlockNumber = startBlockNumber ? startBlockNumber : 1;
    endBlockNumber = endBlockNumber ? endBlockNumber : await web3.eth.getBlockNumber()

    for (var i = startBlockNumber; i <= endBlockNumber; i++) {
        let block = await web3.eth.getBlock(i);
        if (block != null) {
            if (block.transactions != null && block.transactions.length != 0) {
                transactions = transactions.concat(block.transactions);
            }
        }
    }

    for (var i = 0; i < transactions.length; i++) {
        let trans = await web3.eth.getTransaction(transactions[i]);
        let decodedInput = web3.utils.hexToAscii(trans.input);
        let fromAddress = trans.from;
        let blockNo = trans.blockNumber;
        //get only the input
        let input = decodedInput.slice(trans.input.length - 1478);
        //remove the key
        let cleanMsg = input.substring(0, 20) + input.substring(40);
        //get the key
        let dbKey = input.substring(20, 40);
        //Get private key from DB
        var dbRsp = await db.query("SELECT privateKey FROM votingsys.keypairs where id = ?;", [dbKey]);
        let prvKey = '';
        if (dbRsp && dbRsp.length > 0 && dbRsp[0].privateKey) {
            prvKey = dbRsp[0].privateKey;
        }



        if (prvKey) {
            //Decrypt msg
            let decryptMsg = hlp.decryptWithPrivateKey(prvKey, Buffer.from(cleanMsg, "base64")).toString();
            var dbRsp = await db.query("select vatId from votingsys.voters where bchAddress  = ?;", [fromAddress]);
            let vatId = '';
            if (dbRsp && dbRsp.length > 0 && dbRsp[0].vatId) {
                vatId = dbRsp[0].vatId;
            }
            let obj = JSON.parse('{"blockNo":' + blockNo + ',"fromAddress":"' + fromAddress + '","vatId":"' + vatId + '","candidate":"' + decryptMsg + '"}');
            transInputs.push(obj);
        }
    }

    return transInputs;
}

//App
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'static')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
}));

app.get('/', function (request, response) {

    if (!request.session.loggedin) {
        // Render login template
        response.sendFile(path.join(__dirname + '/login.html'));
    } else {
        response.redirect('/main');
    }
});

app.post('/auth', async function (req, res) {

    let username = req.body.username;
    let password = req.body.password;

    if (!username) {
        res.status(400).send({
            errorMsg: 'Username is not defined',
        });
    } else if (!password) {
        res.status(400).send({
            errorMsg: 'pPassword is not defined',
        });
    } else {
        var dbRsp = await db.query("SELECT count(*) as res FROM login_details WHERE user_name = ? AND user_password = ?", [username, password]);
        if (dbRsp[0].res == 1) {
            req.session.loggedin = true;
            req.session.username = username;

            var dbRsp = await db.query("SELECT user_role as res FROM login_details WHERE user_name = ? AND user_password = ?", [username, password]);
            if (dbRsp[0].res == 'admin') {
                req.session.role = 'admin';
                res.redirect('/admin');
            } else {
                res.redirect('/main');
            }

        } else {
            res.sendFile(path.join(__dirname + '/failLogin.html'));
        }

    }
});

app.get('/admin', function (request, response) {
    // If the user is loggedin
    if (request.session.loggedin && request.session.role == 'admin') {
        // Output username
        response.sendFile(path.join(__dirname + '/admin.html'));
    } else {
        // Not logged in
        response.redirect('/');
    }

});

app.get('/comfirmedVote', function (request, response) {
    // If the user is loggedin
    if (request.session.loggedin) {
        // Render page
        response.sendFile(path.join(__dirname + '/comfirmedVote.html'));
    } else {
        response.redirect('/main');
    }
});

app.get('/main', function (request, response) {
    // If the user is loggedin
    if (request.session.loggedin) {
        // Output username
        response.sendFile(path.join(__dirname + '/main.html'));
    } else {
        // Not logged in
        response.redirect('/');
    }

});

app.get('/voting', function (request, response) {
    // If the user is loggedin
    if (request.session.loggedin && request.headers.referer == process.env.SITE_ADDRESS + ':' + process.env.PORT + '/main') {
        // Output username
        response.sendFile(path.join(__dirname + '/voting.html'));
    } else {
        // Not logged in
        response.redirect('/main');
    }
    // response.end();
});

app.post('/getPasscode', async function (req, res) {

    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    var votingStatusRes = await contract.methods
        .votingPeriod()
        .call();
    if (votingStatusRes != 'active') {
        res.status(200).send({
            errorMsg: 'Voting Status is not yet Active',
        });
    } else {

        //get body data from request
        req.session.bcAddress = req.body.bcAddress;
        let vatId = req.session.username;
        let email = ''
        var dbRsp = await db.query("SELECT email FROM votingsys.login_details where user_name = ? ;", [vatId]);
        if (dbRsp[0].email) {
            email = dbRsp[0].email;
        }
        var clientIp = requestIp.getClientIp(req);

        //Validation
        if (!vatId) {
            res.status(400).send({
                errorMsg: 'vatId is not defined',
            });
        } else if (vatId && vatId.length > 9) {
            res.status(400).send({
                errorMsg: 'vatId max length is 9',
            });
        } else if (!email) {
            res.status(400).send({
                errorMsg: 'email is not defined',
            });
        } else {
            var passcode = hlp.genPasscode();
            var dbRsp = await db.query("INSERT INTO votingsys.passcodes (passcode, vatId, ipAddress) VALUES(?,?,?); ", [hlp.hash(passcode.toString()), hlp.hash(vatId), clientIp]);
            if (dbRsp.affectedRows == 1) {
                var mailRsp = await mail.send('<p>This is your passcode to prove your identity : <b>' + passcode + '</b></p>', [email]);
                res.status(200).send({
                    status: 'OK',
                });
            } else if (dbRsp.affectedRows == 0) {
                res.status(400).send({
                    errorMsg: 'The Insert statement could not be completed!',
                    errorCode: '20007',
                });
            } else {
                res.status(400).send({
                    errorMsg: 'A problem occured with Database!',
                    errorCode: '20009',
                });
            }

        }
    }
});

app.post('/addAddress', async function (req, res) {

    //get body data from request
    let bcAddress = req.session.bcAddress;
    let vatId = req.session.username;
    let passcode = req.body.passcode;
    var clientIp = requestIp.getClientIp(req);

    //Validation
    if (!bcAddress) {
        res.status(400).send({
            errorMsg: 'bcAddress is not defined',
        });
    } else if (!vatId) {
        res.status(400).send({
            errorMsg: 'vatId is not defined',
        });
    } else if (vatId && vatId.length > 9) {
        res.status(400).send({
            errorMsg: 'vatId max length is 9',
        });
    } else if (!passcode) {
        res.status(400).send({
            errorMsg: 'passcode is not defined',
        });
    } else {
        const keyPair = hlp.genKeyPair();
        var dbRsp = await db.query("SELECT count(id) as sum FROM votingsys.passcodes where passcode = ? and vatId = ? and ipAddress = ? and current_timestamp() - createdOn  < 60; ", [hlp.hash(passcode.toString()), hlp.hash(vatId), clientIp]);

        if (dbRsp[0].sum == 1) {
            var keypairId = uuid.generateStrongCompactUuid();
            var dbRsp = await db.query("INSERT INTO votingsys.keypairs (id,privateKey, publicKey) VALUES(?,?,?); ", [keypairId, keyPair.privateKey, keyPair.publicKey]);
            if (dbRsp.affectedRows == 1) {
                req.session.pubKey = keyPair.publicKey;
                req.session.keypairId = keypairId;
                var dbRsp = await db.query("SELECT count(*) as sum FROM votingsys.voters where  vatId = ? and bchAddress = ?;", [hlp.hash(vatId), bcAddress]);
                if (dbRsp[0].sum == 0) {
                    var dbRsp = await db.query("INSERT INTO votingsys.voters (vatId, bchAddress) VALUES( ?, ?); ", [hlp.hash(vatId), bcAddress]);
                    if (dbRsp.affectedRows == 1) {
                        res.status(200).send({
                            // publicKey: keyPair.publicKey,
                        });

                    } else if (dbRsp.affectedRows == 0) {
                        res.status(400).send({
                            errorMsg: 'The Insert statement could not be completed!',
                            errorCode: '20001',
                        });
                    } else {
                        res.status(400).send({
                            errorMsg: 'A problem occured with Database!',
                            errorCode: '20002',
                        });
                    }
                } else {
                    res.status(200).send({
                        // publicKey: keyPair.publicKey,
                    });
                }
                //Check how much ETH the address have
                var estimatedCost = 0.0050;
                var balance = await getBalance(bcAddress);

                //if not sufficient send as much they need to do the transaction
                if (balance < estimatedCost) {
                    const nonce = await web3.eth.getTransactionCount(process.env.ADMIN_BCHADDRESS, 'latest'); // nonce starts counting from 0
                    const transaction = {
                        'from': process.env.ADMIN_BCHADDRESS,
                        'to': bcAddress,
                        'value': web3.utils.toWei(estimatedCost + "", "ether"),
                        'gas': 30000,
                        'gasPrice': await fetchGasPrice('raw'),
                    };
                    const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.ADMIN_PRIVATE_KEY);

                    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (error, hash) {
                        if (!error) {
                            console.log(" Error with the hash : ", hash);
                        } else {
                            console.log("Error on transaction:", error)
                        }
                    });
                }

            } else if (dbRsp.affectedRows == 0) {
                res.status(400).send({
                    errorMsg: 'The Insert statement could not be completed!',
                    errorCode: '20003',
                });
            } else {
                res.status(400).send({
                    errorMsg: 'A problem occured with Database!',
                    errorCode: '20004',
                });
            }
        } else if (dbRsp[0].sum == 0) {
            res.status(400).send({
                errorMsg: 'There are no matching results or passcode is expired',
                errorCode: '20005',
            });
        } else {
            res.status(400).send({
                errorMsg: 'A problem occured with Database!',
                errorCode: '20006',
            });
        }

    }
}
);

app.post('/createBallot', async function (req, res) {

    //get body data from request
    let candidate = req.body.candidate.split(',')[0];
    let keypairId = req.session.keypairId;
    let publicKey = req.session.pubKey;

    bchmsg = hlp.encryptWithPublicKey(publicKey, candidate);
    bchmsg = bchmsg.toString('base64');
    bchmsg = bchmsg.substring(0, 20) + keypairId + bchmsg.substring(20);
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;

    res.status(200).send({
        msg: bchmsg,
        abi: ABI,
        contractAddress: CONTRACT_ADDRESS,
    });

});

app.post('/addCandidate', async function (req, res) {
    if (!req.session.loggedin) {
        // Not logged in
        res.redirect('/');
    }

    //get body data from request
    let candidateName = req.body.candidateName;

    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    //Add Candidate to DB
    var dbRsp = await db.query("SELECT count(name) as sum FROM votingsys.candidates where name = ?; ", [candidateName]);
    if (dbRsp[0].sum < 1) {
        var candidatesLenResBef = await contract.methods
            .candidatesLen()
            .call();
        candidatesLenResBef = Number(candidatesLenResBef.toString());

        var AddCandidate = await contract.methods
            .AddCandidate(candidateName)
            .send({ from: process.env.ADMIN_BCHADDRESS, gas: "1000000" })
            .catch(error => console.error(error)); //Have them to gracefully get the error and handle

        var candidatesLenRes = await contract.methods
            .candidatesLen()
            .call();
        candidatesLenRes = Number(candidatesLenRes.toString());

        if (candidatesLenResBef < candidatesLenRes) {
            var dbRsp = await db.query("INSERT INTO votingsys.candidates(id, name) VALUES (?, ?); ", [candidatesLenRes, candidateName]);
            if (dbRsp.affectedRows == 1) {
                res.status(200).send({
                    msg: 'OK',
                });
            }
        } else {
            res.status(400).send({
                errorMsg: 'Transaction with blockchain failed',
                errorCode: '20009',
            });

        }
    } else {
        res.status(400).send({
            errorMsg: 'Candidate name already exist',
            errorCode: '20008',
        });
    }
});

app.get('/getCandidatesList', async function (req, res) {
    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    var candidatesLenRes = await contract.methods
        .candidatesLen()
        .call();
    candidatesLenRes = Number(candidatesLenRes.toString());
    candidateList = [];
    if (candidatesLenRes > 0) {
        for (var i = 0; i < candidatesLenRes; i++) {
            var specificCandidate = await contract.methods
                .candidates(i)
                .call();
            var obj = {
                name: specificCandidate,
                value: i
            };
            candidateList.push(obj);
        }
    }

    res.status(200).send({
        list: candidateList,
    });

});

app.get('/startVoting', async function (req, res) {
    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    var startVoting = await contract.methods
        .StartVoting()
        .send({ from: process.env.ADMIN_BCHADDRESS, gas: "1000000" })
        .catch(error => console.error(error)); //Have them to gracefully get the error and handle

    var startVotingRes = await contract.methods
        .votingPeriod()
        .call();

    res.status(200).send({
        result: startVotingRes
    });

});

app.get('/endVoting', async function (req, res) {
    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    var stopVoting = await contract.methods
        .StopVoting()
        .send({ from: process.env.ADMIN_BCHADDRESS, gas: "1000000" })
        .catch(error => console.error(error)); //Have them to gracefully get the error and handle

    var stopVotingRes = await contract.methods
        .votingPeriod()
        .call();

    res.status(200).send({
        result: stopVotingRes,
    });

});

app.get('/getVotingStatus', async function (req, res) {
    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );

    var votingStatusRes = await contract.methods
        .votingPeriod()
        .call();

    res.status(200).send({
        result: votingStatusRes,
    });

});

app.post('/countVotes', async function (req, res) {

    
    //Check if the candidate Name is a valid one else delete the record
    //Contract call
    const CONTRACT_ADDRESS = process.env.CONTRACT_BCHADDRESS;
    const contract = new web3.eth.Contract(
        ABI,
        CONTRACT_ADDRESS
    );
    
    var votingPeriod = await contract.methods
    .votingPeriod()
    .call();
    
    if (votingPeriod != 'deactivated') {
        res.status(200).send({
            error: "Voting Period --> Not Deactivated",
        });
        
    } else {
        votingCountList = [];
    
        let records = await getAllInputs();
    
        //Get the latest vote for this particular vatId
        for (var i = records.length - 1; i >= 0; i--) {
            for (var x = i - 1; x >= 0; x--) {
                if (records[i].vatId == records[x].vatId) {
                    records.splice(x, 1);
                    break;
                }
            }
        }
        
        //Get Candidate List
        var candidatesLenRes = await contract.methods
            .candidatesLen()
            .call();
        candidatesLenRes = Number(candidatesLenRes.toString());
        candidateList = [];
        if (candidatesLenRes > 0) {
            for (var i = 0; i < candidatesLenRes; i++) {
                var specificCandidate = await contract.methods
                    .candidates(i)
                    .call();

                candidateList.push(specificCandidate);
            }
        }

        for (var i = records.length - 1; i >= 0; i--) {
            if (!candidateList.includes(records[i].candidate)) {
                records.splice(i, 1);
            }
        }

        //After CleanUp - Count the remaining votes
        for (var i = 0; i < records.length; i++) {
            let found = false;
            for (var x = 0; x < votingCountList.length; x++) {
                if (votingCountList[x].name == records[i].candidate) {
                    votingCountList[x].votes++;
                    found = true;
                    break;
                }
            }
            if (!found) {
                var obj = {
                    name: records[i].candidate,
                    votes: 1,
                };
                votingCountList.push(obj);
            }
        }

        res.status(200).send({
            list: votingCountList,
        });
    }
});

app.post('/logout', async function (req, res) {
    req.session.destroy();
});

app.listen(
    process.env.PORT,
    () => console.log('Server Started on ' + process.env.SITE_ADDRESS + ':' + process.env.PORT)
);