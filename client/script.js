var socket = null,
	nickname = null,
	ytPlayer = null,
	currentYtVidId = null;

$(document).ready(function() {
	init();
});

////////////////////////////////////////////////////////////////////////////////

function init()
{
	// setup socket.io
	socket = io.connect();

	socket.on('connect', function() {
	});

	socket.on('disconnect', function() { });

	socket.on('announcement', function(data) {
		$('#activity_container').prepend('<div>' + data.msg + '</div>');
	});

	socket.on('app_status_update', function(data) {
		if (ytPlayer) {
			if (data.currentTrack != null) {			
				if (data.currentTrack.ytVidId != currentYtVidId) {
					ytPlayer.loadVideoById(data.currentTrack.ytVidId, data.currentTime, 'small');
					currentYtVidId = data.currentTrack.ytVidId;
				} else if (Math.abs(ytPlayer.getCurrentTime() - data.currentTime) > 5) {
					ytPlayer.seekTo(data.currentTime, true);
				}
		
				$('#now_playing').html(data.currentTrack.title + '(' + data.currentTime + '/' + data.currentTrack.duration + ')');
			} else {
				$('#now_playing').html('');
			}

			// update playlist
			$('#playlist').empty();

			for(var i=0; i<data.playlist.length; i++) {
				var track = data.playlist[i];

				$('#playlist').append('<div class="playlist_item">' + track.title + '</div>');
			}

			// update listening users
			$('#listeners').empty();

			for(var socketId in data.connectedSockets) {
				var user = data.connectedSockets[socketId];

				$('#listeners').append('<div class="listener">' + user.nickname + '</div>');
			}
		}
	});

	// setup controls
	$('#like_button').button({
		icons : {
			primary : 'ui-icon-heart'
		}
	}).click(function () {
		socket.emit('like');
	});

	$('#skip_button').button({
		icons : {
			primary : 'ui-icon-seek-next'
		}
	}).click(function () {
		socket.emit('skip');
	});

	$('#volume_slider').slider({
		change : function(event, ui) {
			ytPlayer.setVolume(ui.value);
		}
	});
	
	// setup the youtube player
	var params = { allowScriptAccess: "always" };
	var atts = { id: "myytplayer" };
	swfobject.embedSWF(
		"http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid=ytplayer",
		"ytapiplayer", "100", "75", "8", null, null, params, atts
	);

	
}

function onYouTubePlayerReady(playerId) 
{
	ytPlayer = document.getElementById('myytplayer');

	// initialize the slider to the ytPlayer volume
	$('#volume_slider').slider('value', ytPlayer.getVolume());
}

function submitSearch()
{
	var query = encodeURIComponent($('#search_box').val().trim());

	$.getScript(
		'http://gdata.youtube.com/feeds/api/videos?v=2&q=' + query + '&max-results=10&format=5&alt=json-in-script&callback=searchCallback'
	);
}

function searchCallback(data)
{
	var entries = data.feed.entry || [];
	
	$('#search_results').empty();

	for (var i=0; i<entries.length; i++) {
		var entry = entries[i];	

		(function (ytVidId, title, duration) {
			var resultDiv = $('<div class="search_result">' + title + '</div>');

			resultDiv.click(function() {
				addToPlaylist(ytVidId, title, duration);
				$('#search_results').empty();
			});

			$('#search_results').append(resultDiv);
		})(entry.media$group.yt$videoid.$t, entry.title.$t, entry.media$group.yt$duration.seconds);
	}
}

function addToPlaylist(ytVidId, title, duration)
{
	socket.emit('add_to_playlist', {
		ytVidId : ytVidId,
		title : title,
		duration : duration
	});
}

function setNickname()
{
	socket.emit('set_nickname', {nickname : $('#nickname_box').val()});
}
