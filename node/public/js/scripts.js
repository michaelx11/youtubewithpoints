$(document).ready(function(){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase('https://youtubewithpoints.firebaseio.com/');
  var strikeWords = ['nope', 'doubly nope', 'goodbye'];
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
      if (video.strikes === 0) {
        video.strikes = {};
      }
      var strikes = Object.keys(video.strikes).length;
      console.log(strikes);
      
      var strikeWord = strikeWords[strikes];
      html += '<div class="playlist-item">';
      html += '<div class="isplaying">' + playing + '</div> ';
      html += '<div class="uploader">' + video.owner + '</div> ';
      html += '<div class="title">' + video.name + '<span class="strike ' + id + '">' + strikeWord + '</span></div> ';
      html += '</div>';
      playing = '';

      if (playingVideoLink == '' || (counter == 0 && playingVideoLink != video.link)) {
        var url = '/time';
        var playingVideoLink = video.link;
        $.get(url, function(data){
          console.log(playingVideoLink);
          playingVideo = playingVideoLink + '?autoplay=1&' + data;
          $('#ytplayer').attr('src',playingVideo);
        })
      }
      
      counter ++;
    }
    $('.populated-playlist').html(html);
  });
});
