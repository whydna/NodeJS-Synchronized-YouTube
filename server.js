var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	mime = require('mime'),
	io = require('socket.io'),
	sanitizer = require('sanitizer');

////////////////////////////////////////////////////////////////////////////////

// Defining some data models
function TrackModel(ytVidId, title, duration, socketId) {
	this.ytVidId = (typeof ytVidId !== 'undefined') ? ytVidId : null;
	this.title = (typeof title !== 'undefined') ? title : null;
	this.duration = (typeof duration !== 'undefined') ? duration : null;
}

function UserModel(nickname)
{
	this.nickname = (typeof nickname !== 'undefined') ? nickname : null;
}

////////////////////////////////////////////////////////////////////////////////

var appConfig = {
	updateFrequency : 1
}

var appStatus = {
	currentTime : 0, // 
	currentTrack : null, // TrackModel
	playlist : [], // TrackModel[]
	connectedSockets : {} // map of socketId => UserModel
};

////////////////////////////////////////////////////////////////////////////////

// start the node server
var server = http.createServer(function(request, response) {
	var requestPath = url.parse(request.url).pathname;
	requestPath = (requestPath == '/') ? '/index.html' : requestPath;
	requestPath = './client' + requestPath;

	path.exists(requestPath, function(exists) {
		if (!exists) {
			response.writeHead(404, {'Content-Type': 'text/plain'});  
			response.end('404 Not Found\n', 'binary');  
		} else {
			fs.readFile(requestPath, 'binary', function(error, data) {  
				if(error) {  
					response.writeHead(500, {'Content-Type': 'text/plain'});  
					response.end(error + '\n', 'binary');  
				} else {
					response.writeHead(200, {'Content-Type': mime.lookup(requestPath)});  
					response.end(data, 'binary');
				}
			});  
		}
	});
});

server.listen(8080);

////////////////////////////////////////////////////////////////////////////////

// start socket.io
io = io.listen(server);

io.sockets.on('connection', function(socket) {
	appStatus.connectedSockets[socket.id] = new UserModel('Guest');
	
	socket.on('disconnect', function() {
		delete appStatus.connectedSockets[socket.id];
	});

	socket.on('set_nickname', function(data) {
		var newNickname = sanitizer.sanitize(data.nickname);
		var oldNickname = appStatus.connectedSockets[socket.id].nickname;

		appStatus.connectedSockets[socket.id].nickname = newNickname;

		io.sockets.emit('announcement', {msg : oldNickname + ' changed their nickname to ' + newNickname});

		console.log(oldNickname + ' changed their nickname to ' + newNickname);
	});

	socket.on('add_to_playlist', function(data) {
		var nickname = appStatus.connectedSockets[socket.id].nickname;

		appStatus.playlist.push(new TrackModel(
			data.ytVidId, 
			data.title, 
			data.duration
		));

		io.sockets.emit('announcement', {msg : nickname + ' added ' + data.title});
	});

	socket.on('like', function(data) {
		var nickname = appStatus.connectedSockets[socket.id].nickname;
		var trackTitle = appStatus.currentTrack.title;

		io.sockets.emit('announcement', {msg : nickname + ' liked ' + trackTitle});
	});

	socket.on('skip', function(data) {
		if (appStatus.currentTrack != null) {
			var trackTitle = appStatus.currentTrack.title; 

			nextTrack();
		
			io.sockets.emit('announcement', {msg : trackTitle + 'was skipped'});
		}
	});
});

////////////////////////////////////////////////////////////////////////////////

// start everything up
setInterval(update, appConfig.updateFrequency * 1000);

////////////////////////////////////////////////////////////////////////////////

function update()
{
	if (appStatus.currentTrack == null) {
		if (appStatus.playlist.length > 0) {
			nextTrack();
		}
	} else {
		if (appStatus.currentTime >= appStatus.currentTrack.duration) {
			nextTrack();
		}

		appStatus.currentTime += appConfig.updateFrequency;		
	}

	io.sockets.emit('app_status_update', appStatus);

	console.log(appStatus);
}

function nextTrack()
{
	if (appStatus.playlist.length > 0) {
		var nextTrack = appStatus.playlist.shift();
		
		appStatus.currentTrack = nextTrack;
		appStatus.currentTime = 0;
	} else {
		appStatus.currentTrack = null;
		appStatus.currentTime = 0;
	}
}

