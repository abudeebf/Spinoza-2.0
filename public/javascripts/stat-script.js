var socket = io.connect();
socket.on('pageview', function(message) {
  $('#connections').text(message.connections);
});