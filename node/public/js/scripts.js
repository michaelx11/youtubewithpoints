window.location.hash = '';
$(document).ready(function(){
$.get('/firebase', function(database){
  var playingVideo = '';
  var playingVideoLink = '';
  var dataRef = new Firebase(database);
  var strikeWords = ['nope', 'doubly nope', 'goodbye', 'leaving...'];
  var mute = false;
  var PLAY_SYMBOL = '&#9658;'
  
  var allStars = {};
  
  $.get('/getstars', function(data) {
    window.allStars = data;
  });
  
  var submitLink = function() {
    var youtubeLink = $('.url-input').val();
    var url = '/submit';
    var data = {link: youtubeLink};
    $('.url-input').fadeOut(300, function() {
      $('.url-input').val('');
      $('.url-input').fadeIn(300);
    });
    $.post(url, data, function(msg) {
      console.log(msg);
      if (msg['success']) {
        var songId = msg['id'];
        var songTitle = msg['songTitle'];
        console.log('created song with ID ' + songId);
        
        // NOTE: this does not create listeners for songs already in the queue. perhaps
        // something we would want to think about, if the user were to leave the page
        dataRef.child('queue/' + songId + '/stars').on('value', function(songStars) {
          if (songStars.val() > 0) {
            var m = '<span class="good-news">"' + songTitle + '" was starred by another user!</span>';
            $('.status-msg').html(m);
            $('.status-msg')
              .stop()
              .fadeIn(300)
              .delay(2000)
              .fadeOut(300);
          }
        });
        
      } else if (msg !== '') {
        if (msg.indexOf("<") > -1) {
          msg = 'Error: Server probably restarted - please refresh your browser';
        }
        $('.status-msg').text(msg);
        $('.status-msg')
          .stop()
          .fadeIn(300)
          .delay(2000)
          .fadeOut(300);
      } else {
        // what happened here?
      }
    });
  }
  
  var toggleMute = function() {
  if (!mute) {
      $.get('/mute');
      $('#ytplayer').attr('src','');
      $('.play0').text('');
      $('.mute-btn').css('background-position', '0px');
      mute = true;
    } else {
      $.get('/unmute');
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

  var generateStarList = function() { 
    var html = '';
    $.get('/getstars', function(data) {
      window.allStars = data;
      for (id in data) {
        var title = data[id].title;
        var link = data[id].link;
        
        
        // STAR GENERATION SCRIPT VERSION 0.2
        // WHY YES, THIS CODE IS THE SAME AS BELOW. GOOD LUCK FUTURE DEV.
        var dataForStar = 'data-link="' + escape(link) + '"';
        dataForStar += 'data-title="' + escape(title) + '"';
        dataForStar += 'data-songid="' + escape(id) + '"';
        var starredClass = '';
        var allStars = data;
        for (idj in allStars) {
          if (allStars[idj].link === link) {
            starredClass = 'star-starred';
          }
        }
        var stardiv = '<div class="in-list star star' + id + ' ' + starredClass + '" ' + dataForStar + '></div>';
        var regexp = /embed\/([\w-_]+)/
        var youtubelink = '<a class="ext" target="_blank" href="http://youtube.com/watch?v='+regexp.exec(link)[1]+'">open in youtube</a>';
        
        // REMOVE NEXT LINE TO ALLOW OPEN IN YOUTUBE LINK
        var youtubelink = '';
        
        html += '<div class="star-list-item" data-link="'+link+'">'+stardiv+title+youtubelink+'</div>'
      }
      $('.star-list')
        .html(html)
        .show();
    })
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
    if ($('.scoreboard').css('top') == '0px') {
      $('.scoreboard-footer').fadeOut();
      $('.scoreboard').animate({top: 1200}, 800);
      $('body').css({overflow: 'auto'});
    } else {
    
      dataRef.child('users').once('value', function(snapshot) {
        var users = snapshot.val();
        var sortable = [];
        for (var u in users)
          sortable.push([users[u].username, users[u].score])
        sortable.sort(function(a, b) {return b[1] - a[1]})
        var html = "<table>";
        for (i in sortable) {
          var u = getFormattedName(sortable[i][0]);
          var s = sortable[i][1];
          var yourself = '';
          if (sortable[i][0] === user)
            var yourself = 'class="yourself"';
          html += '<tr ' + yourself + '><td>' + u + '</td><td class="points">' + s + '</td></tr>';
        }
        html += "</table>";
        $('.score-container').html(html);
      });
    
      $('.scoreboard-footer').fadeIn();
      $('.scoreboard').animate({top: 0}, 800);
      $('body').css({overflow: 'hidden'});
    }
  });
  
  $('.close-btn').on('click', function() {
    $('.scoreboard-footer').fadeOut();
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
    $('.star-list').fadeOut(100);
  });
  
  
  // this bit of code will be interesting
  $('.url-input').focusout(function() {
  })
  $(document).on('click', function(){ 
    setTimeout(function(){$('.star-list').fadeOut(100)},100);
  })
  
  $(document).on('click', '.star-list-item', function(e) {
    var link = $(this).data('link');
    $('.url-input').val(link);
    $('.star-list').fadeOut(100);
    e.stopPropagation();
  });
  
  
  $(document).keypress(function(e) {
    if (e.which == 32) {
      toggleMute();
    }
  })
  
  $('.submit-footer-btn').on('click', function(){
    submitLink();
  });
  
  $(document).on('click', '.star', function(e) {
    var l = unescape($(this).data('link'));
    var t = unescape($(this).data('title'));
    var s = unescape($(this).data('songid'));
    if ($(this).parent().attr('class') === 'star-list-item') {
      e.stopPropagation();
    }
    
    if ($(this).hasClass('star-starred')) {
      var url = '/unstar';
      $(this).removeClass('star-starred');
      $('.star' + s).removeClass('star-starred');
    } else {
      // shiny effect because i want to
      $('.url-input-overlay')
        .stop()
        .fadeTo(100, 0.9)
        .fadeOut(400);
      var url = '/star';
      $(this).addClass('star-starred');
      $('.star' + s).addClass('star-starred');
    }
    var data = {link: l, title: t, songId: s};
    $.post(url, data, function(e) {
      $.get('/getstars', function(data) {
        window.allStars = data;
      });
    }).fail(function(b, e){ 
      console.log(e);
    });
  });
  
  $(document).on('click', '.strike', function(){
    var id = $(this).attr('class').split(' ')[1];
    var url = '/strike';
    var data = {songId: id};
    $.post(url, data, function(e) {
    });
  });
  
  $(document).on('click', '.rescueable', function(){
    var id = $(this).attr('class').split(' ')[1];
    var url = '/like';
    var data = {songId: id};
    $.post(url, data, function(e) {
    });
  });
  
  $(document).on('click', '.url-input', function() {
    generateStarList();
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
      var rescueable = '';
      
      if (video.strikes === 0) {
        video.strikes = {};
      }
      
      if (video.likes === 0) {
        video.likes = {};
      }
      
      var strikes = Object.keys(video.strikes).length;
      strikes -= Object.keys(video.likes).length;
      
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
      
      // This logic is really annoying. Please think before editing.
      if (strikes > 0 && video.likes[user] == undefined && video.strikes[user] == undefined) {
        var rescueable = '<span class="rescueable ' + id + '">rescue</span>';
      }
      
      // STAR GENERATION SCRIPT VERSION 0.2
      // i dont even use jquery proprly, why, victor, why
      var dataForStar = 'data-link="' + escape(video.link) + '"';
      dataForStar += 'data-title="' + escape(video.name) + '"';
      dataForStar += 'data-songid="' + escape(id) + '"';
      var starredClass = '';
      var allStars = window.allStars
      for (idj in allStars) {
        if (allStars[idj].link === video.link) {
          starredClass = 'star-starred';
        }
      }
      var stardiv = '<div class="star star' + id + ' ' + starredClass + '" ' + dataForStar + '></div>';
      
      // TO REENABLE RESCUEING, SIMPLY REMOVE THE FOLLOWING LINE.
      // BUT THIS HAS BEEN TAKEN OUT UNTIL WE DO SOME TESTING
      rescueable = '';
      
      var isAnnouncementVideo = "http://www.youtube.com/embed/dpN3rJWlRx8" === video.link;
      if (isAnnouncementVideo) {
        var strikeAble = '';
        var announcementGray = ' announcement-gray';
      } else {
        var strikeAble = '<div class="operators"><span class="strike ' + id + gray + '">' + strikeWord + '</span> '+rescueable+stardiv+'</div>';
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
