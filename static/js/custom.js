// Login with Web3 via Metamasks window.ethereum library
async function loginWithEth() {
    if (window.web3) {
        try {
            const selectedAccount = await window.ethereum
                .request({
                    method: "eth_requestAccounts",
                })
                .then((accounts) => accounts[0])
                .catch(() => {
                    throw Error("No account selected!");
                });
            window.userAddress = selectedAccount;
            window.localStorage.setItem("userAddress", selectedAccount);
            showAddress();


        } catch (error) {
            console.error(error);
        }
    } else {
        alert("No ETH brower extension detected.");
    }
}

function moveToVote() {
    document.getElementById("passcode").value = "";

    // Data to be sent in the POST request (in JSON format)
    const postData = {
        bcAddress: window.userAddress,
    };

    // POST request options
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/getPasscode', requestOptions)
        .then(response => {
            // Check if the request was successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Parse the JSON response
            return response.json();
        })
        .then(data => {
            // Handle the data returned from the server
            // console.log('Post request response:', data);
            if (data.status == 'OK') {
                document.getElementById("passcodeForm").style.display = "";
                document.getElementById("moveToVote").classList.add("invisible");
                document.getElementById("logoutfromEthAdd").classList.add("invisible");
            }else if(data.errorMsg){
                alert(data.errorMsg);
            }


        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation:', error);
        });
}

function addCandidate() {
    var name = document.getElementById("name").value;

    // Data to be sent in the POST request (in JSON format)
    const postData = {
        candidateName: name,
    };

    // POST request options
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/addCandidate', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            // Handle the data returned from the server
            // console.log('Post request response:', data);
            if (data.errorMsg) {
                alert(data.errorMsg);
                throw new Error(data.errorMsg);
            }

            if (data.msg) {
                alert(document.getElementById("name").value + ' Added to list!');
            }

            document.getElementById("name").value = '';
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation:', error);
        });

}

function addAddress() {
    let passcode = document.getElementById("passcode").value;

    // Data to be sent in the POST request (in JSON format)
    const postData = {
        passcode: passcode,
    };

    // POST request options
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/addAddress', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.errorMsg) {
                alert(data.errorMsg + ' ' + data.errorCode);
                throw new Error(data.errorMsg);
            } else {
                window.location.href = 'http://localhost:8080/voting'; //Don't make it hardcoded
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation:', error);
        });

}

// remove stored user address and reset frontend
function logoutfromEthAdd() {
    window.userAddress = null;
    window.localStorage.removeItem("userAddress");
    showAddress();
}

function logout() {

    const postData = {
    };

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/logout', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            // console.error('There was a problem with the fetch operation');
        });

    window.location.href = 'http://localhost:8080/'; 

}

function getList() {

    const requestOptions = {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        },

    };

    // Make the GET request
    fetch('http://localhost:8080/getCandidatesList', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.list) {
                //create list component
                select = document.getElementById('candidateSelect');
                for (var i = 0; i < data.list.length; i++) {
                    var opt = document.createElement('option');
                    opt.value = data.list[i].name + ',' + data.list[i].value;
                    opt.innerHTML = data.list[i].name;
                    select.appendChild(opt);
                }
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation');
        });
}
// Display or remove the users know address on the frontend
function showAddress() {
    if (!window.userAddress) {
        document.getElementById("userAddress").innerText = "";
        // document.getElementById("SHA256-Address").innerText = "";
        document.getElementById("headerTxt").innerText = `Please login`;
        document.getElementById("moveToVote").classList.add("invisible");
        document.getElementById("logoutfromEthAdd").classList.add("invisible");
        document.getElementById("loginButton").classList.remove("invisible");
        return false;
    }

    document.getElementById("userAddress").innerText = window.userAddress;
    document.getElementById("headerTxt").innerText = `ETH Address: `;
    document.getElementById("moveToVote").classList.remove("invisible");
    document.getElementById("logoutfromEthAdd").classList.remove("invisible");
    document.getElementById("loginButton").classList.add("invisible");

}

function vote() {

    let candidate = document.getElementById("candidateSelect").value;

    // Data to be sent in the POST request (in JSON format)
    const postData = {
        candidate: candidate,
    };

    // POST request options
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/createBallot', requestOptions)
        .then(response => {
            // Check if the request was successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Parse the JSON response
            return response.json();
        })
        .then(data => {
            // Handle the data returned from the server
            //console.log('Post request response:', data);
            let msg = data.msg;
            let abi = data.abi;
            let contractAddress = data.contractAddress;

            if (window.web3) {
                try {
                    sendVote(msg, abi, contractAddress);
                } catch (error) {
                    console.error(error);
                }
            } else {
                alert("Vote did not send");
            }

        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation:', error);
        });





}

async function sendVote(msg, abi, contractAddress) {
    const contract = new window.web3.eth.Contract(
        abi,
        contractAddress
    );

    const result = await contract.methods
        .Vote(msg)
        .send({ from: window.userAddress, gas: "1000000" }); 

    let trans = await getTransaction(result.transactionHash);
    let decoded = window.web3.utils.hexToAscii(trans.input);
    if (decoded.includes(msg)) {
        window.location.href = 'http://localhost:8080/comfirmedVote';
    } else {
        alert('a problem occured!')       
    }

}

async function getTransaction(trId) {
    try {
        let transaction = await window.web3.eth.getTransaction(trId);
        return transaction;
    } catch (error) {
        console.error(`Failed to get the transaction due to an error: ${error}`);
    }

}

function countVotes() {

    // Data to be sent in the POST request (in JSON format)
    const postData = {
    };

    // POST request options
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    };

    // Make the POST request
    fetch('http://localhost:8080/countVotes', requestOptions)
        .then(response => {
            // Check if the request was successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Parse the JSON response
            // console.log(response);
            return response.json();
        })
        .then(data => {
            // Handle the data returned from the server
            let tblData = data.list;
            if (data.list) {
                let table = document.getElementById('voteTable');
                table.innerHTML = '';
                var htmlTable = '';
                htmlTable += '<tr><th>Name</th><th>Votes</th></tr>'
                for (var i = 0; i < tblData.length; i++) {
                    htmlTable += '<tr><td>' + tblData[i].name + '</td><td>' + tblData[i].votes + '</td></tr>'
                }
                table.innerHTML += htmlTable;

            } else if (data.error) {
                let errorMsg = document.getElementById('error')
                errorMsg.innerHTML = data.error;
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation:', error);
        });

}

function startVoting() {
    const requestOptions = {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        },
    };

    // Make the GET request
    fetch('http://localhost:8080/startVoting', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.result) {
                alert("Voting Status : " + data.result);
                getVotingStatus()
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation');
        });
}

function endVoting() {
    const requestOptions = {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        },
    };

    // Make the GET request
    fetch('http://localhost:8080/endVoting', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.result) {
                alert("Voting Status : " + data.result);
                getVotingStatus();
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation');
        });
}

function getVotingStatus() { 
    const requestOptions = {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        },
    };

    // Make the GET request
    fetch('http://localhost:8080/getVotingStatus', requestOptions)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.result) {
                let VotingStatusMsg = document.getElementById('VotingStatus');
                VotingStatusMsg.innerHTML = "Voting Status : <b>" + data.result+"</b>";
                setVisibility(data.result);
            }
        })
        .catch(error => {
            // Handle any errors that occurred during the fetch
            console.error('There was a problem with the fetch operation');
        });

}

function setVisibility(result){
    if(result != 'init'){
        document.getElementById('addCandidateForm').style.display = "none";
    }else{
        document.getElementById('addCandidateForm').style.display = "";
    }

    if(result != 'deactivated'){
        document.getElementById('countVotes').style.display = "none";
    }else{
        document.getElementById('countVotes').style.display = "";
    }
}