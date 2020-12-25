const webSocketServer = require("websocket").server;
const http = require("http");

const getUniqueID = require("./getUniqueID");

const server = http.createServer((req, res) => {
  res.end("this will be an analytics page" + PORT.toString());
});

const PORT = process.env.PORT || 8080;
server.listen(PORT);
console.log(`listening on port ${PORT}`);

const wsServer = new webSocketServer({
  httpServer: server,
});

const clients = {};
var games = [];

wsServer.on("request", (request) => {
  var userID = getUniqueID();
  var gameID = "";
  const connection = request.accept(null, request.origin);
  clients[userID] = connection;

  connection.on("close", () => {
    const game = games.filter((game) => game.gameID === gameID);
    if (game[0]) {
      if (clients[game[0].playerOne]) {
        clients[game[0].playerOne].sendUTF(
          JSON.stringify({ type: "connectionClosed" })
        );
      }
      if (game[0].playerTwo) {
        clients[game[0].playerTwo].sendUTF(
          JSON.stringify({ type: "connectionClosed" })
        );
      }
      games.forEach((game, index) => {
        if (game.gameID === gameID) {
          games.splice(index, 1);
        }
      });
    }
  });

  connection.on("message", (message) => {
    if (message.type === "utf8") {
      const messageObject = JSON.parse(message.utf8Data);

      if (messageObject.type === "gameID") {
        gameID = messageObject.id;
        games.push({ playerOne: userID, gameID: gameID });
      } else if (messageObject.type === "joinGame") {
        gameID = messageObject.id;
        if (JSON.stringify(games).indexOf(gameID) !== -1) {
          games.forEach((game) => {
            if (game.gameID === gameID) {
              if (game.playerTwo) {
                clients[userID].sendUTF(JSON.stringify({ type: "gameFull" }));
              } else {
                game.playerTwo = userID;
                clients[game.playerOne].sendUTF(
                  JSON.stringify({ type: "playerTwoJoined" })
                );
                clients[game.playerTwo].sendUTF(
                  JSON.stringify({ type: "playerTwoJoined" })
                );
              }
            }
          });
        } else {
          clients[userID].sendUTF(JSON.stringify({ type: "noSuchGame" }));
        }
      } else if (messageObject.type === "move") {
        if (gameID !== "") {
          games.forEach((game) => {
            if (game.gameID === messageObject.gameID) {
              const data = {
                type: "move",
                newPosition: messageObject.newPosition,
                oldPosition: messageObject.oldPosition,
                pieceName: messageObject.pieceName,
                actionType: messageObject.actionType,
              };
              clients[game.playerOne].sendUTF(JSON.stringify(data));
              clients[game.playerTwo].sendUTF(JSON.stringify(data));
            }
          });
        }
      } else {
        console.log("message type unknown");
      }
    }
  });
});
