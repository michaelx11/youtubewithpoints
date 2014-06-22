$(document).ready(function(){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase('https://youtubewpoints-dev.firebaseio.com/');
  var strikeWords = ['nope', 'doubly nope', 'goodbye', 'leaving...'];
  var mute = false;
  var PLAY_SYMBOL = '&#9658;'
  
  var submitLink = function() {
    var youtubeLink = $('.url-input').val();
    var url = '/submit';
    var data = {link: youtubeLink};
    $.post(url, data, function(e) {
      $('.url-input').fadeOut(function() {
        $('.url-input').val('');
        $('.url-input').fadeIn();
      });
    });
  }
  
  $('.mute-btn').on('click', function() {
    if (!mute) {
      $('#ytplayer').attr('src','');
      $('.play0').text('');
      $(this).css('background-position', '0px');
      mute = true;
    } else {
      $('.play0').html(PLAY_SYMBOL);
      var url = '/time';
      $.get(url, function(data){
        playingVideo = playingVideoLink + '?autoplay=1&' + data;
        console.log(playingVideo);
        $('#ytplayer').attr('src',playingVideo);
      })
          
      $(this).css('background-position', '-30px');
      mute = false;
    }
  });
  
  $('.url-input').keypress(function(e) {
    if(e.which == 13) {
      submitLink();
    }
  });
  
  $('.submit-footer-btn').on('click', function(){
    submitLink();
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
    var playing = PLAY_SYMBOL;
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
      if (mute) {
        playing = '';
      }
      
      html += '<div class="playlist-item">';
      html += '<div class="isplaying play' + counter + '">' + playing + '</div> ';
      html += '<div class="uploader">' + video.owner.split(' ')[0] + '</div> ';
      html += '<div class="title">' + video.name + '<span class="strike ' + id + gray + '">' + strikeWord + '</span></div> ';
      html += '</div>';
      playing = '';
      
      if (playingVideoLink == '' || (counter == 0 && playingVideoLink != video.link)) {
        var url = '/time';
        playingVideoLink = video.link;
        if (!mute) {
          $.get(url, function(data){
            playingVideo = playingVideoLink + '?autoplay=1&' + data;
            console.log(playingVideo);
            $('#ytplayer').attr('src',playingVideo);
          })
        }
      }
      
      counter ++;
    }
    $('.populated-playlist').html(html);
  });
});
