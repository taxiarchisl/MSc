// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyElections {
    // Array to store the names of candidates
    string[] public candidates;
    // Variable to keep track of the number of candidates
    uint256 public candidatesLen = 0;
    // Array to store the ballots (votes)
    string[] public ballots;
    // Variable to keep track of the number of ballots
    uint256 public ballotsLen = 0;
    // Variable to represent the current voting period state
    // Possible states: "init", "active", "deactivated"
    string public votingPeriod = "init";
    // Address of the contract owner
    address owner;

    // Constructor sets the deployer as the owner
    constructor() {
        owner = msg.sender;
    }

    // Modifier to restrict function access to the owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    // Adds a new candidate to the election
    // @param name The name of the candidate to add
    function AddCandidate(string memory name) public onlyOwner {
        require(bytes(name).length != 0, "Length cannot be equal to 0!");
        require(keccak256(abi.encodePacked("init")) == keccak256(abi.encodePacked(votingPeriod)), "To Add Candidate votingPeriod should be in init state!");
        candidates.push(name);
        candidatesLen++;
    }

    // Starts the voting period, changing its state to "active"
    // @return The new state of the voting period
    function StartVoting() public onlyOwner returns (string memory) {
        if (keccak256(abi.encodePacked("init")) == keccak256(abi.encodePacked(votingPeriod))) {
            votingPeriod = "active";
        }
        return votingPeriod;
    }

    //  Stops the voting period, changing its state to "deactivated"
    // @return The new state of the voting period
    function StopVoting() public onlyOwner returns (string memory) {
        if (keccak256(abi.encodePacked("active")) == keccak256(abi.encodePacked(votingPeriod))) {
            votingPeriod = "deactivated";
        }
        return votingPeriod;
    }

    // Allows a user to cast a vote (ballot)
    // @param ballot The name of the candidate being voted for
    function Vote(string memory ballot) public {
        require(bytes(ballot).length != 0, "Length cannot be equal to 0!");
        require(keccak256(abi.encodePacked("active")) == keccak256(abi.encodePacked(votingPeriod)), "To Vote votingPeriod should be in active state!");
        ballots.push(ballot);
        ballotsLen++;
    }
}
