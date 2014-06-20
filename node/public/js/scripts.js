$(document).ready(function(){
  var playingVideo = '';
  var dataRef = new Firebase('https://youtubewithpoints.firebaseio.com/');
  dataRef.once('value', function(snapshot) {
    var queue = snapshot.val().queue;
    var html = '';
    var playing = '&#9658;';
    for (i in queue) {
      var video = queue[i];
      html += '<div class="playlist-item">';
      html += '<div class="isplaying">' + playing + '</div> ';
      html += '<div class="uploader">' + video.owner + '</div> ';
      html += '<div class="title">' + video.name + '</div> ';
      html += '</div>';
      playing = '';
      
      if (playingVideo == '') {
        //playingVideo = video.link + '?autoplay=1&origin=http://example.com'
        //$('#ytplayer').attr('src',playingVideo);
      }
    }
    $('.populated-playlist').html(html);
  });
});