$(document).ready(function(){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase('https://youtubewithpoints.firebaseio.com/');
  
  $('.submit-footer-btn').on('click', function(){
    var youtubeLink = $('.url-input').val();
    var url = '/submit';
    var data = {link: youtubeLink};
    $.post(url, data, function(e) {
      $('.url-input').fadeOut(function() {
        $('.url-input').val('');
        $('.url-input').fadeIn();
      });
    });
  });
  
  $(document).on('click', '.strike', function(){
    var id = $(this).attr('class').split(' ')[1];
    var url = '/strike';
    var data = {songId: id};
    $.post(url, data, function(e) {
      console.log('strike for song');
    });
  });
  
  dataRef.on('value', function(snapshot) {
    var queue = snapshot.val().queue;
    var html = '';
    var counter = 0;
    var playing = '&#9658;';
    for (i in queue) {
      var id = i;
      var video = queue[i];
      html += '<div class="playlist-item">';
      html += '<div class="isplaying">' + playing + '</div> ';
      html += '<div class="uploader">' + video.owner + '</div> ';
      html += '<div class="title">' + video.name + '<span class="strike ' + id + '">nope</span></div> ';
      html += '</div>';
      playing = '';
      
      // currently in: PLAY WHATEVER COMES UP MODE
      // add counter == 0 back to play normal mode, right after the second ( of 
      // the following line
      if (playingVideo == '' || (counter == 0 && playingVideoLink != video.link)) {
        var url = '/time';
        $.get(url, function(data){
          playingVideoLink = video.link;
          playingVideo = video.link + '?autoplay=1&' + data;
          console.log(playingVideo);
          $('#ytplayer').attr('src',playingVideo);
        })
      }
      
      counter ++;
    }
    $('.populated-playlist').html(html);
  });
});
