$(document).ready(function(){
$.get('/firebase', function(database){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase(database);
  var strikeWords = ['nope', 'doubly nope', 'goodbye', 'leaving...'];
  var mute = false;
  var PLAY_SYMBOL = '&#9658;'

  var submitLink = function() {
    var youtubeLink = $('.url-input').val();
    var url = '/submit';
    var data = {link: youtubeLink};
    $('.url-input').fadeOut(300, function() {
      $('.url-input').val('');
      $('.url-input').fadeIn(300);
    });
    $.post(url, data, function(msg) {
      if (msg !== '') {
        if (msg.indexOf("<") > -1) {
          msg = 'Error: Server probably restarted - please refresh your browser';
        }
        $('.status-msg').text(msg);
        $('.status-msg')
          .stop()
          .fadeIn(300)
          .delay(2000)
          .fadeOut(300);
      }
    });
  }
  
  var toggleMute = function() {
  if (!mute) {
      $('#ytplayer').attr('src','');
      $('.play0').text('');
      $('.mute-btn').css('background-position', '0px');
      mute = true;
    } else {
      $('.play0').html(PLAY_SYMBOL);
      var url = '/time';
      $.get(url, function(data){
        playingVideo = playingVideoLink + '?autoplay=1&' + data;
        console.log(playingVideo);
        $('#ytplayer').attr('src',playingVideo);
        generateProgressBar();
      })
          
      $('.mute-btn').css('background-position', '-30px');
      mute = false;
    }
  }
  
  var generateProgressBar = function() {
    // progress bar population
    var $bar = $('.progress');
    $bar.css({width: "0%"});
    $.get('/progress', function(data){
      currentWidth = data.split(' ')[0] + '%';
      timeToEnd = data.split(' ')[1] * 1000;
      $bar.css({width: currentWidth});
      $bar.stop().animate({width: '100%'}, timeToEnd, 'linear', function(){});
    });   
  }

  var getFormattedName = function(n) {
    var nameChunks = n.split(' ');
    return nameChunks[0] + ' ' + nameChunks[nameChunks.length-1].charAt(0);
  }

  var forceRefresh = function() {
    $.get('/loggedin', function(data) {
      if (data === 'no') {
        location.reload();
      }
    });
  }
  
  $.get('/userstatus', function(data) {
    if (data == "new") {
      // detected new user, display intro screen
      $('.intro').fadeIn(100);
    }
  })
  
  $('.showme-btn').on('click', function() {
    $('.intro').fadeOut();
  })
  
  $('.confused').on('click', function() {
    $('.intro').fadeIn(100);
  })
  
  $('.score-btn').on('click', function() {
  console.log($('.scoreboard').css('top'));
    if ($('.scoreboard').css('top') == '0px') {
      $('.scoreboard').animate({top: 1200}, 800);
      $('body').css({overflow: 'auto'});
    } else {
      $('.scoreboard').animate({top: 0}, 800);
      $('body').css({overflow: 'hidden'});
    }
  });
  
  $('.close-btn').on('click', function() {
    $('.scoreboard').animate({top: 1200}, 800);
    $('body').css({overflow: 'auto'});
  });
  
  $('.mute-btn').on('click', function() {
    toggleMute();
  });
  
  $('.url-input').keypress(function(e) {
    if(e.which == 13) {
      submitLink();
    }
  });
  
  $(document).keypress(function(e) {
    if (e.which == 32) {
      toggleMute();
    }
  })
  
  $('.submit-footer-btn').on('click', function(){
    submitLink();
  });
  
  $(document).on('click', '.strike', function(){
    var id = $(this).attr('class').split(' ')[1];
    var url = '/strike';
    var data = {songId: id};
    $.post(url, data, function(e) {
    });
  });
  
  dataRef.child('users').on('value', function(snapshot) {
    var users = snapshot.val();
//    console.log(users);
    var sortable = [];
    for (var u in users)
      sortable.push([users[u].username, users[u].score])
    sortable.sort(function(a, b) {return b[1] - a[1]})
    var html = "<table>";
    for (i in sortable) {
      var u = getFormattedName(sortable[i][0]);
      var s = sortable[i][1];
      html += '<tr><td>' + u + '</td><td class="points">' + s + '</td></tr>';
    }
    html += "</table>";
    $('.score-container').html(html);
  });
  
  dataRef.child('queue').on('value', function(snapshot) {
    var queue = snapshot.val();
    var html = '';
    var counter = 0;
    var playing = PLAY_SYMBOL;

    // force logged out users to relog when queue is touched
    forceRefresh();
    
    for (i in queue) {
      var id = i;
      var video = queue[i];
      if (video.strikes === 0) {
        video.strikes = {};
      }
      var strikes = Object.keys(video.strikes).length;
//      console.log(strikes);
      
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
      
      var isAnnouncementVideo = "http://www.youtube.com/embed/dpN3rJWlRx8" === video.link;
      if (isAnnouncementVideo) {
        var strikeAble = '';
        var announcementGray = ' announcement-gray';
      } else {
        var strikeAble = '<span class="strike ' + id + gray + '">' + strikeWord + '</span>';
        var announcementGray = '';
      }
      
      html += '<div class="playlist-item ' + announcementGray + '">';
      html += '<div class="isplaying play' + counter + '">' + playing + '</div> ';
      html += '<div class="uploader">' + getFormattedName(video.owner) + '</div> ';
      html += '<div class="title">' + video.name + strikeAble + '</div> ';
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
            generateProgressBar();
          })
        }
        
      }
      
      counter ++;
    }
    $('.populated-playlist').html(html);
  });
});
});