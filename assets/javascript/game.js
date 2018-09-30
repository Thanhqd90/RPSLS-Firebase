// Initialize Firebase
var config = {
    apiKey: "AIzaSyChaixGPFRoFBCT2RwkjEh8YMsFIsR0-cc",
    authDomain: "rock-paper-scissors-onli-8c278.firebaseapp.com",
    databaseURL: "https://rock-paper-scissors-onli-8c278.firebaseio.com",
    projectId: "rock-paper-scissors-onli-8c278",
    storageBucket: "rock-paper-scissors-onli-8c278.appspot.com",
    messagingSenderId: "160564442969"
};

firebase.initializeApp(config);

// database connection references
var data = firebase.database();
var playersRef = data.ref("/players");
var chatRef = data.ref("/chat");
var connectedRef = data.ref(".info/connected");

// Global Variables - Contains player information
var playerName;
var playerNumber;
var playerObject;

var resetId;

var player1LoggedIn = false
var player2LoggedIn = false

var player1Object = {
    name: "",
    choice: "",
    wins: 0,
    losses: 0
}
var player2Object = {
    name: "",
    choice: "",
    wins: 0,
    losses: 0
}

// Log in functions

// Hide/Show windows depending on numnber of players
function loginPending() {
    $(".pre-connection, .pre-login, .post-login, .selections").hide();
    $(".pending-login").show();
}

function showLoginScreen() {
    $(".pre-connection, .pending-login, .post-login, .selections").hide();
    $(".pre-login").show();
}

// Show input box to log in
function showLoggedInScreen() {
    $(".pre-connection, .pre-login, .pending-login").hide();
    $(".post-login").show();
    if (playerNumber == "1") {
        $(".p1-selections").show();
    } else {
        $(".p1-selections").hide();
    }
    if (playerNumber == "2") {
        $(".p2-selections").show();
    } else {
        $(".p2-selections").hide();
    }
}

// when the login button is clicked, add the new player to the open player slot
$("#login").click(function (e) {
    e.preventDefault();

    // check to see which player slot is available
    if (!player1LoggedIn) {
        playerNumber = "1";
        playerObject = player1Object;
    }
    else if (!player2LoggedIn) {
        playerNumber = "2";
        playerObject = player2Object;
    }
    else {
        playerNumber = null;
        playerObject = null;
    }

    // if a slot was found, update it with the new information
    if (playerNumber) {
        playerName = $("#player-name").val().trim();
        playerObject.name = playerName;
        $("#player-name").val("");

        $("#player-name-display").text(playerName);
        $("#player-number").text(playerNumber);

        data.ref("/players/" + playerNumber).set(playerObject);
        data.ref("/players/" + playerNumber).onDisconnect().remove();
    }

});
// Handle lost connection
connectedRef.on("value", function (snap) {
    if (!snap.val() && playerNumber) {
        data.ref("/players/" + playerNumber).remove();
        playerNumber = null;

        // reset screen
        showLoginScreen();
    }
}, errorHandler);

// Chat functions

// Add chat to HTML if received by firebase
chatRef.on("child_added", function (chatSnap) {
    let chatObj = chatSnap.val();
    let chatText = chatObj.text;
    let chatLogItem = $("<li>").attr("id", chatSnap.key);

    // Styles the messages red or blue based on their player number
    if (chatObj.userId == "system") {
        chatLogItem.addClass("system");
    } else if (chatObj.userId == playerNumber) {
        chatLogItem.addClass("user-1");
    } else {
        chatLogItem.addClass("user-2");
    }

    // Adds username before chatText
    if (chatObj.name) {
        chatText = "<strong>" + chatObj.name + ":</strong> " + chatText;
    }
    chatLogItem.html(chatText);
    $("#chat-log").append(chatLogItem);
    $("#chat-log").scrollTop($("#chat-log")[0].scrollHeight);
}, errorHandler);

// Remove chat from the HTML if removed from firebase
chatRef.on("child_removed", function (chatSnap) {
    $("#" + chatSnap.key).remove();
}, errorHandler);

// Updates player status upon sign in
playersRef.on("child_added", function (childSnap) {
    window["player" + childSnap.key + "LoggedIn"] = true;
    window["player" + childSnap.key + "Object"] = childSnap.val();
}, errorHandler);

// Updates player object when player changes
playersRef.on("child_changed", function (childSnap) {
    window["player" + childSnap.key + "Object"] = childSnap.val();

    updateStats();
}, errorHandler);

// Reset player object and boolean if player leaves
playersRef.on("child_removed", function (childSnap) {
    chatRef.push({
        userId: "system",
        text: childSnap.val().name + " has disconnected"
    });

    window["player" + childSnap.key + "LoggedIn"] = false;
    window["player" + childSnap.key + "Object"] = {
        name: "",
        choice: "",
        wins: 0,
        losses: 0
    };

    // when both players log out, clear the chat
    if (!player1LoggedIn && !player2LoggedIn) {
        chatRef.remove();
    }
}, errorHandler);

// Game logic
playersRef.on("value", function (snap) {
    // Updates player names based on status
    $("#player-1").text(player1Object.name || "Waiting for Player 1 to sign in");
    $("#player-2").text(player2Object.name || "Waiting for Player 2 to sign in");

    // Updates names based on order of sign in
    updatePlayerBox("1", snap.child("1").exists(), snap.child("1").exists() && snap.child("1").val().choice);
    updatePlayerBox("2", snap.child("2").exists(), snap.child("2").exists() && snap.child("2").val().choice);

    // display correct "screen" depending on logged in statuses
    if (player1LoggedIn && player2LoggedIn && !playerNumber) {
        loginPending();
    } else if (playerNumber) {
        showLoggedInScreen();
    } else {
        showLoginScreen();
    }

    // if both players have selected their choice, perform the comparison
    if (player1Object.choice && player2Object.choice) {
        compare(player1Object.choice, player2Object.choice);
    }

}, errorHandler);


// when a selection is made, send it to the database
$(".selection").click(function () {
    // If player is not logged return nothing
    if (!playerNumber) return;

    playerObject.choice = this.id;
    data.ref("/players/" + playerNumber).set(playerObject);

    $(`.p${playerNumber}-selections`).hide();
    $(`.p${playerNumber}-selection-reveal`).html(`<h6>You selected <strong>${this.id}</strong> <i class="fas fa-hand-${this.id}"></i></h6>`).show();
});

function showSelections() {
    $(".selections, .pending-selection, .selection-made").hide();
    $(".selection-reveal").show();
}

// Send chat message to the database
$("#send-chat").click(function (e) {
    e.preventDefault();

    chatRef.push({
        userId: playerNumber,
        name: playerName,
        text: $("#chat").val().trim()
    });

    $("#chat").val("");
});

// Main game logic - Compare player choices
function compare(p1choice, p2choice) {
    $(".p1-selection-reveal").text(p1choice);
    $(".p2-selection-reveal").text(p2choice);

    showSelections();

    if (p1choice == p2choice) {
        // Tie
        $("#feedback").text("TIE");
        
        // Please help me DRY this ;_;
    }   else if ((p1choice == "rock" && p2choice == "scissors") || (p1choice == "paper" && p2choice == "rock") || (p1choice == "scissors" && p2choice == "paper") ||        (p1choice == "rock" && p2choice == "lizard") || (p1choice == "scissors" && p2choice == "lizard") || (p1choice == "lizard" && p2choice == "spock") || (p1choice ==    "lizard" && p2choice == "paper") || (p1choice == "paper" && p2choice == "spock") || (p1choice == "spock" && p2choice == "rock")) {

        // Update P1 score based on outcome
        $("#feedback").html(`${p1choice} beats ${p2choice} <br/><br/> ${player1Object.name} wins!!`);

        if (playerNumber == "1") {
            playerObject.wins++;
        } else {
            playerObject.losses++;
        }
        } else {
            // Update P2 score based on outcome
            $("#feedback").html(`${p2choice} beats ${p1choice} <br/><br/> ${player2Object.name} wins!!`);

            if (playerNumber == "2") {
                playerObject.wins++;
            } else {
                playerObject.losses++;
            }
        }

        resetId = setTimeout(reset, 3000);
        }


function reset() {
    clearTimeout(resetId);

    playerObject.choice = "";

    data.ref("/players/" + playerNumber).set(playerObject);

    $(".selection-reveal").hide();
    $("#feedback").empty();
}

function updateStats() {
    ["1", "2"].forEach(playerNum => {
        var obj = window[`player${playerNum}Object`];
        $(`#p${playerNum}-wins`).text(obj.wins);
        $(`#p${playerNum}-losses`).text(obj.losses);
    });

    if (player1LoggedIn === true) {
       $(".p1-stats").show();
    }   else {
            $(".p1-stats").hide();
        }
    if (player2LoggedIn === true) {
        $(".p2-stats").show();
    }   else {
            $(".p2-stats").hide();
        }
}

function updatePlayerBox(playerNum, exists, choice) {
    if (exists) {
        if (playerNumber != playerNum) {
            if (choice) {
                $(`.p${playerNum}-selection-made`).show();
                $(`.p${playerNum}-pending-selection`).hide();
            } else {
                $(`.p${playerNum}-selection-made`).hide();
                $(`.p${playerNum}-pending-selection`).show();
            }
        }
    } else {
        $(`.p${playerNum}-selection-made`).hide();
        $(`.p${playerNum}-pending-selection`).hide();
    }
}

function errorHandler(error) {
    console.log("Error:", error.code);
}
