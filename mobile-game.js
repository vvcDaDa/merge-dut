/* Mobile compatibility runtime: native Canvas 2D + the same Matter physics. ES5 syntax. */
(function () {
  'use strict';
  var M = window.CampusMatter;
  var schools = [
    ['厦门大学',21,'#678a91'],['武汉大学',26,'#6f9478'],['南开大学',32,'#8f729b'],
    ['同济大学',39,'#568da1'],['南京大学',46,'#89709d'],['复旦大学',54,'#6481a3'],
    ['浙江大学',63,'#649ab0'],['上海交通大学',73,'#b77a78'],['北京大学',84,'#ac6a69'],
    ['清华大学',97,'#9d75a6'],['大连理工大学',112,'#b49b61']
  ];
  function $(id) { return document.getElementById(id); }
  var board=$('game'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx||!M){if(window.campusBootFailed)window.campusBootFailed('游戏画布未能启动，请重新加载。');return;}
  var constrained=(navigator.deviceMemory>0&&navigator.deviceMemory<=2)||(navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4);
  var scale=constrained?1.5:2;
  canvas.width=440*scale;canvas.height=570*scale;board.appendChild(canvas);
  document.body.classList.add('mobile-device');
  function fit(){
    var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||700;
    document.documentElement.style.setProperty('--mobile-board-width',Math.floor(Math.max(230,Math.min(520,(h-210)*440/570)))+'px');
    var w=board.clientWidth||Math.min(400,window.innerWidth-24),height=Math.round(w*570/440);
    board.style.paddingBottom='0';board.style.height=height+'px';
    canvas.style.setProperty('width',w+'px','important');canvas.style.setProperty('height',height+'px','important');
    canvas.style.position='absolute';canvas.style.top='0';canvas.style.left='0';
  }
  fit();window.addEventListener('resize',fit);if(window.visualViewport)window.visualViewport.addEventListener('resize',fit);
  var best=0;try{best=Number(localStorage.getItem('campus-merge-best'))||0;}catch(e){}
  var state={score:0,best:best,current:0,next:0,aim:220,paused:false,over:false,won:false,sound:false,unlocked:[]};
  var engine=M.Engine.create({enableSleeping:true,positionIterations:6,velocityIterations:4});engine.gravity.y=1.15;
  var bounds=[M.Bodies.rectangle(-5,280,20,900,{isStatic:true}),M.Bodies.rectangle(445,280,20,900,{isStatic:true}),M.Bodies.rectangle(220,580,460,20,{isStatic:true})];
  M.Composite.add(engine.world,bounds);
  var coins=[],queue=[],sprites=[],elapsed=0,readyAt=0,danger=0,warning=false,particles=[],activePointer=null,lastFrame=0,accumulator=0,victoryTimer=null,audio=null,toastTimer=null;
  for(var i=0;i<11;i++){
    var li=document.createElement('li');li.id='level-'+i;li.className='level'+(i===10?' final':'');
    li.innerHTML='<span class="number">'+('0'+(i+1)).slice(-2)+'</span><img src="assets/icons/'+i+'.png" alt="'+schools[i][0]+'校徽"><span class="school">'+schools[i][0]+'</span><span class="badge">待合成</span>';$('levels').appendChild(li);
  }
  function hud(){
    if(state.score>state.best){state.best=state.score;try{localStorage.setItem('campus-merge-best',state.best);}catch(e){}}
    $('score').textContent=state.score;$('best').textContent=state.best;
    $('next').src='assets/icons/'+state.next+'.png';$('next').alt='下一枚：'+schools[state.next][0];
    for(var j=0;j<11;j++){
      var item=$('level-'+j),yes=!!state.unlocked[j];item.className='level'+(j===10?' final':'')+(yes?' unlocked':'');
      item.querySelector('.badge').textContent=j===10?(yes?'已点亮 · 终极':'终极目标'):(yes?'已点亮':'待合成');item.setAttribute('aria-label',schools[j][0]+'，'+(yes?'已点亮':'未解锁'));
    }
  }
  function toast(text){$('toast').textContent=text;$('toast').className='show';window.clearTimeout(toastTimer);toastTimer=window.setTimeout(function(){$('toast').className='';},2100);}
  function tone(level){if(!state.sound)return;try{var A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audio)audio=new A();if(audio.resume)audio.resume();var o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.setValueAtTime(300+level*65,audio.currentTime);o.frequency.exponentialRampToValueAtTime(600+level*70,audio.currentTime+.13);g.gain.setValueAtTime(.24,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.22);o.start();o.stop(audio.currentTime+.23);}catch(e){}}
  function dialog(kind){state.paused=true;activePointer=null;$('overlay').hidden=false;$('overlay-tag').textContent=kind==='over'?'UNTIL NEXT TIME':kind==='win'?'HELLO, DALIAN TECH!':'TAKE A BREAK';$('overlay-title').textContent=kind==='over'?'校园装不下啦':kind==='win'?'你好，大连理工！':'休息一下';$('overlay-text').textContent=kind==='over'?'本局获得 '+state.score+' 分，换个落点再试一次。':kind==='win'?'你已合成大连理工大学！可以继续挑战更高分。':'你的校徽正在原地等你。';$('continue').hidden=kind==='over';$('pause').textContent='▷ 继续';}
  function resume(){if(state.over)return;state.paused=false;lastFrame=0;accumulator=0;$('overlay').hidden=true;$('pause').innerHTML='Ⅱ <span>暂停</span>';}
  function randomLevel(){var n=Math.random();return n<.44?0:n<.75?1:n<.94?2:3;}
  function clamp(x,r){return Math.max(r+8,Math.min(432-r,x));}
  function spawn(level,x,y){var r=schools[level][1],b=M.Bodies.circle(clamp(x,r),Math.min(y,566-r),r,{restitution:.19,friction:.28,frictionAir:.008,frictionStatic:.7});var c={body:b,level:level,born:elapsed,active:true,merging:false};b.campusCoin=c;coins.push(c);M.Composite.add(engine.world,b);return c;}
  function drop(){if(state.paused||state.over||elapsed<readyAt)return;spawn(state.current,state.aim,43);state.unlocked[state.current]=true;readyAt=elapsed+620;state.current=state.next;state.next=randomLevel();hud();}
  function reset(){window.clearTimeout(victoryTimer);for(var j=0;j<coins.length;j++)M.Composite.remove(engine.world,coins[j].body);M.Engine.clear(engine);coins=[];queue=[];particles=[];elapsed=0;readyAt=0;danger=0;warning=false;activePointer=null;state.score=0;state.current=0;state.next=randomLevel();state.aim=220;state.over=false;state.won=false;state.unlocked=[true];resume();hud();$('status').textContent='点击投下一枚校徽';}
  function contacts(event){for(var j=0;j<event.pairs.length;j++){var p=event.pairs[j],a=p.bodyA.campusCoin,b=p.bodyB.campusCoin;if(a&&b&&a.active&&b.active&&!a.merging&&!b.merging&&a.level===b.level){a.merging=b.merging=true;queue.push([a,b]);}}}
  M.Events.on(engine,'collisionStart',contacts);M.Events.on(engine,'collisionActive',contacts);
  function merge(){var pending=queue;queue=[];for(var j=0;j<pending.length;j++){
    var a=pending[j][0],b=pending[j][1];if(!a.active||!b.active)continue;var x=(a.body.position.x+b.body.position.x)/2,y=(a.body.position.y+b.body.position.y)/2,level=a.level;
    a.active=b.active=false;M.Composite.remove(engine.world,a.body);M.Composite.remove(engine.world,b.body);
    state.score+=level===10?4096:Math.pow(2,level+1);var target=Math.min(10,level+1);tone(target);
    if(level<10){var c=spawn(target,x,y);M.Body.setVelocity(c.body,{x:0,y:-1.2});if(!state.unlocked[target]){state.unlocked[target]=true;toast('点亮新大学 · '+schools[target][0]);}if(target===10&&!state.won){state.won=true;victoryTimer=window.setTimeout(function(){if(!state.over)dialog('win');},650);}}
    else toast('双重大工！校徽消除 +4096');
    for(var k=0;k<3;k++){var angle=Math.random()*Math.PI*2;particles.push({x:x,y:y,vx:Math.cos(angle)*2,vy:Math.sin(angle)*2,life:22,color:schools[target][2]});}hud();
  }coins=coins.filter(function(c){return c.active;});}
  function step(){
    if(state.paused||state.over)return;elapsed+=1000/60;M.Engine.update(engine,1000/60);merge();
    var threatened=false;for(var j=0;j<coins.length;j++){var c=coins[j];if(elapsed-c.born>2400&&c.body.position.y-schools[c.level][1]<110&&c.body.speed<1.5){threatened=true;break;}}
    danger=threatened?danger+1000/60:0;if(warning!==threatened){warning=threatened;$('status').textContent=warning?'即将越线！快找机会合成':'点击投下一枚校徽';}if(danger>2300){state.over=true;dialog('over');}
    for(var n=particles.length-1;n>=0;n--){var p=particles[n];p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life<=0)particles.splice(n,1);}
  }
  function seal(level,x,y,angle,alpha){var r=schools[level][1];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(sprites[level],-r,-r,r*2,r*2);ctx.restore();}
  function draw(){
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,440,570);ctx.strokeStyle=warning?'#c77561':'#abb79b';ctx.lineWidth=1;ctx.beginPath();for(var x=14;x<430;x+=12){ctx.moveTo(x,110);ctx.lineTo(x+6,110);}ctx.stroke();
    for(var j=0;j<coins.length;j++){var c=coins[j];seal(c.level,c.body.position.x,c.body.position.y,c.body.angle,1);}
    if(!state.over&&elapsed>=readyAt){var aim=clamp(state.aim,schools[state.current][1]);ctx.strokeStyle='#a4b197';ctx.globalAlpha=.45;ctx.beginPath();for(var y=82;y<553;y+=12){ctx.moveTo(aim,y);ctx.lineTo(aim,y+4);}ctx.stroke();ctx.globalAlpha=1;seal(state.current,aim,43,0,.9);}
    for(var n=0;n<particles.length;n++){var p=particles[n];ctx.fillStyle=p.color;ctx.globalAlpha=p.life/22;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  }
  function aim(e){var rect=canvas.getBoundingClientRect();if(rect.width>0)state.aim=(e.clientX-rect.left)*440/rect.width;}
  function cancel(){activePointer=null;}
  if(window.PointerEvent){
    canvas.addEventListener('pointerdown',function(e){if(activePointer!==null||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;e.preventDefault();activePointer=e.pointerId;aim(e);try{canvas.setPointerCapture(e.pointerId);}catch(ignore){}});
    canvas.addEventListener('pointermove',function(e){if(activePointer===e.pointerId||(activePointer===null&&e.pointerType==='mouse'))aim(e);});
    canvas.addEventListener('pointerup',function(e){if(activePointer!==e.pointerId)return;e.preventDefault();activePointer=null;aim(e);drop();});canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
  }else{
    canvas.addEventListener('touchstart',function(e){if(activePointer!==null||!e.changedTouches.length)return;e.preventDefault();activePointer=e.changedTouches[0].identifier;aim(e.changedTouches[0]);},{passive:false});
    canvas.addEventListener('touchmove',function(e){for(var j=0;j<e.changedTouches.length;j++)if(e.changedTouches[j].identifier===activePointer){e.preventDefault();aim(e.changedTouches[j]);break;}},{passive:false});
    canvas.addEventListener('touchend',function(e){for(var j=0;j<e.changedTouches.length;j++)if(e.changedTouches[j].identifier===activePointer){e.preventDefault();activePointer=null;aim(e.changedTouches[j]);drop();break;}},{passive:false});canvas.addEventListener('touchcancel',cancel);
    canvas.addEventListener('mousedown',function(e){if(e.button===0){activePointer='mouse';aim(e);}});canvas.addEventListener('mousemove',aim);window.addEventListener('mouseup',function(e){if(activePointer==='mouse'){activePointer=null;aim(e);drop();}});
  }
  window.addEventListener('blur',cancel);
  $('pause').onclick=function(){if(!state.over){if(state.paused)resume();else dialog('pause');}};$('continue').onclick=resume;$('over-restart').onclick=reset;
  $('restart').onclick=function(){if(!state.over&&!state.paused&&state.score>0){dialog('pause');$('overlay-title').textContent='要开始新的一局吗？';$('overlay-text').textContent='点击下方「重新开始」清空本局，个人最佳会保留。';}else reset();};
  $('sound').onclick=function(){state.sound=!state.sound;$('sound').textContent='音效 · '+(state.sound?'开':'关');if(state.sound)tone(2);};
  document.addEventListener('visibilitychange',function(){if(document.hidden&&!state.paused&&!state.over)dialog('pause');lastFrame=0;accumulator=0;});
  function raf(fn){if(window.requestAnimationFrame)return window.requestAnimationFrame(fn);return window.setTimeout(function(){fn(Date.now());},17);}
  function frame(now){raf(frame);if(lastFrame&&now-lastFrame<15)return;var dt=lastFrame?Math.min(100,now-lastFrame):1000/60;lastFrame=now;if(!state.paused&&!state.over){accumulator+=dt;var steps=0;while(accumulator>=1000/60&&steps<5){step();accumulator-=1000/60;steps++;}}if(!state.paused)draw();}
  var remaining=11,failed=false;
  function load(level){var image=new Image();image.onload=function(){
    var r=schools[level][1],size=Math.min(512,Math.max(128,Math.pow(2,Math.ceil(Math.log(r*2*scale)/Math.LN2)))),sprite=document.createElement('canvas');sprite.width=sprite.height=size;var g=sprite.getContext('2d');g.scale(size/256,size/256);g.fillStyle='#fffefa';g.beginPath();g.arc(128,128,126,0,Math.PI*2);g.fill();g.strokeStyle=schools[level][2];g.lineWidth=3;g.stroke();g.save();g.beginPath();g.arc(128,128,117,0,Math.PI*2);g.clip();var ratio=Math.min(222/image.width,222/image.height),w=image.width*ratio,h=image.height*ratio;g.drawImage(image,128-w/2,128-h/2,w,h);g.restore();sprites[level]=sprite;remaining--;
    if(!remaining&&!failed){reset();draw();if(window.campusBootReady)window.campusBootReady();raf(frame);}
  };image.onerror=function(){failed=true;if(window.campusBootFailed)window.campusBootFailed('校徽加载失败，请重新加载。');};image.src='assets/mobile/'+level+'.png';}
  for(var n=0;n<11;n++)load(n);
  if(/[?&]test=1/.test(window.location.search||''))window.campusMobileTest={state:state,spawn:spawn,reset:reset,drop:drop,step:step,draw:draw,engine:engine,getCoins:function(){return coins;},getReadyAt:function(){return readyAt;}};
})();
