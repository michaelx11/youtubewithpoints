$(document).ready(function(){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase('https://youtubewpoints-dev.firebaseio.com/');
  var strikeWords = ['nope', 'doubly nope', 'goodbye', 'leaving...'];
  
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
  
  dataRef.child('queue').on('value', function(snapshot) {
    var queue = snapshot.val();
    var html = '';
    var counter = 0;
    var playing = '&#9658;';
    for (i in queue) {
      var id = i;
      var video = queue[i];
      if (video.strikes === 0) {
        video.strikes = {};
      }
      var strikes = Object.keys(video.strikes).length;
      console.log(strikes);
      
      if (strikes > 3){
        strikes = 3;
      }
      var strikeWord = strikeWords[strikes];
      
      if (video.strikes[user] !== undefined) {
        var gray = ' gray-out';
      } else {
        var gray = '';
      }
      html += '<div class="playlist-item">';
      html += '<div class="isplaying">' + playing + '</div> ';
      html += '<div class="uploader">' + video.owner.split(' ')[0] + '</div> ';
      html += '<div class="title">' + video.name + '<span class="strike ' + id + gray + '">' + strikeWord + '</span></div> ';
      html += '</div>';
      playing = '';

      if (playingVideoLink == '' || (counter == 0 && playingVideoLink != video.link)) {
        var url = '/time';
        playingVideoLink = video.link;
        $.get(url, function(data){
          playingVideo = playingVideoLink + '?autoplay=1&' + data;
          console.log(playingVideo);
          $('#ytplayer').attr('src',playingVideo);
        })
      }
      
      counter ++;
    }
    $('.populated-playlist').html(html);
  });
});
