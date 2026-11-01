/* Phaser 3 + Matter.js. Physics uses positive Y gravity and fixed circular bodies. */
const RENDER_SCALE = Math.min(5, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 640 / 440)));
const SEAL_TEXTURE_SIZE = 1024;
const SCHOOLS = [
 ['厦门大学',21,'#678a91'],['武汉大学',26,'#6f9478'],['南开大学',32,'#8f729b'],
 ['同济大学',39,'#568da1'],['南京大学',46,'#89709d'],['复旦大学',54,'#6481a3'],
 ['浙江大学',63,'#649ab0'],['上海交通大学',73,'#b77a78'],['北京大学',84,'#ac6a69'],
 ['清华大学',97,'#9d75a6'],['大连理工大学',112,'#b49b61']
].map(([name,radius,color],level)=>({name,radius,color,level}));
const $=id=>document.getElementById(id);
function readBest(){try{return Number(localStorage.getItem('campus-merge-best'))||0}catch{return 0}}
const state={score:0,best:readBest(),current:0,next:0,aim:220,paused:false,over:false,won:false,unlocked:new Set([0]),sound:false};
let scene, audioContext, toastTimer;
$('best').textContent=state.best;
SCHOOLS.forEach((s,i)=>{let li=document.createElement('li');li.className='level'+(i===10?' final':'');li.id='level-'+i;li.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><img src="assets/${i}.png" alt="${s.name}校徽"><span class="school">${s.name}</span><span class="badge">${i===10?'终极目标':'待合成'}</span>`;$('levels').append(li)});
function updateHud(){
 $('score').textContent=state.score;
 if(state.score>state.best){state.best=state.score;try{localStorage.setItem('campus-merge-best',state.best)}catch{}}
 $('best').textContent=state.best;$('next').src=`assets/${state.next}.png`;$('next').alt='下一枚：'+SCHOOLS[state.next].name;
 for(let i=0;i<11;i++){let li=$('level-'+i),yes=state.unlocked.has(i);li.classList.toggle('unlocked',yes);li.querySelector('.badge').textContent=i===10?(yes?'已点亮 · 终极':'终极目标'):yes?'已点亮':'待合成';li.setAttribute('aria-label',SCHOOLS[i].name+'，'+(yes?'已点亮':'未解锁'))}
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2100)}
function tone(level){if(!state.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.connect(g);g.connect(audioContext.destination);o.type='sine';o.frequency.setValueAtTime(300+level*65,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(600+level*70,audioContext.currentTime+.13);g.gain.setValueAtTime(.24,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.22);o.start();o.stop(audioContext.currentTime+.23)}catch{}}
function dialog(kind){state.paused=true;scene.matter.world.pause();$('overlay').hidden=false;$('overlay-tag').textContent=kind==='over'?'UNTIL NEXT TIME':kind==='win'?'HELLO, DALIAN TECH!':'TAKE A BREAK';$('overlay-title').textContent=kind==='over'?'校园装不下啦':kind==='win'?'你好，大连理工！':'休息一下';$('overlay-text').textContent=kind==='over'?`本局获得 ${state.score} 分。换个落点，再创造一次可能。`:kind==='win'?'你已合成最大校徽，点亮全部 11 所大学！可以继续挑战更高分。':'你的校徽正在原地等你。';$('continue').hidden=kind==='over';$('pause').textContent='▷ 继续';}
function resume(){if(state.over)return;state.paused=false;scene.matter.world.resume();$('overlay').hidden=true;$('pause').innerHTML='Ⅱ <span>暂停</span>';scene.lastTime=0}
class CampusScene extends Phaser.Scene{
 constructor(){super('campus');this.coins=new Set();this.merges=[];this.readyAt=0;this.elapsed=0;this.danger=0;this.lastTime=0;this.keys={};}
 preload(){SCHOOLS.forEach(s=>this.load.image('logo'+s.level,`assets/${s.level}.png`))}
 create(){scene=this;this.cameras.main.setZoom(RENDER_SCALE).centerOn(220,285);this.matter.world.setBounds(5,-300,430,870,20,true,true,false,true);this.matter.world.engine.positionIterations=10;this.matter.world.engine.velocityIterations=8;
  SCHOOLS.forEach(s=>{const key='seal'+s.level;if(this.textures.exists(key))return;const texture=this.textures.createCanvas(key,SEAL_TEXTURE_SIZE,SEAL_TEXTURE_SIZE),ctx=texture.context;ctx.scale(4,4);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#fffefa';ctx.beginPath();ctx.arc(128,128,126,0,Math.PI*2);ctx.fill();ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.stroke();ctx.save();ctx.beginPath();ctx.arc(128,128,117,0,Math.PI*2);ctx.clip();const source=this.textures.get('logo'+s.level).getSourceImage(),ratio=Math.min(222/source.width,222/source.height),w=source.width*ratio,h=source.height*ratio;ctx.drawImage(source,128-w/2,128-h/2,w,h);ctx.restore();texture.refresh()});
  this.line=this.add.graphics().setDepth(2);this.guide=this.add.graphics().setDepth(1);this.ghost=this.add.image(220,43,'seal0').setDepth(5).setAlpha(.88);this.reset();
  this.input.on('pointermove',p=>{state.aim=this.cameras.main.getWorldPoint(p.x,p.y).x});this.input.on('pointerup',p=>{state.aim=this.cameras.main.getWorldPoint(p.x,p.y).x;this.drop()});
  this.input.keyboard.on('keydown',e=>{if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();this.keys[e.code]=true;if(e.code==='Space'&&!e.repeat)this.drop();if(e.code==='KeyP'&&!e.repeat)state.paused?resume():dialog('pause')});this.input.keyboard.on('keyup',e=>this.keys[e.code]=false);window.addEventListener('blur',()=>{this.keys={}});
  const contact=event=>{for(const pair of event.pairs){const a=pair.bodyA.gameObject,b=pair.bodyB.gameObject;if(a&&b&&a!==b&&a.level===b.level&&a.active&&b.active&&!a.merging&&!b.merging){a.merging=b.merging=true;this.merges.push([a,b])}}};
  this.matter.world.on('collisionstart',contact);this.matter.world.on('collisionactive',contact);
 }
 reset(){for(const c of this.coins)c.destroy();this.coins.clear();this.merges=[];this.readyAt=0;this.elapsed=0;this.danger=0;state.score=0;state.current=0;state.next=this.randomLevel();state.aim=220;state.over=false;state.won=false;state.unlocked=new Set([0]);resume();this.ghost.setVisible(true);updateHud();$('status').textContent='点击投下一枚校徽'}
 randomLevel(){const r=Math.random();return r<.44?0:r<.75?1:r<.94?2:3}
 spawn(level,x,y){const s=SCHOOLS[level];const coin=this.matter.add.image(Phaser.Math.Clamp(x,s.radius+7,433-s.radius),Math.min(y,566-s.radius),'seal'+level);coin.setCircle(SEAL_TEXTURE_SIZE/2);coin.setDisplaySize(s.radius*2,s.radius*2);coin.setBounce(.19).setFriction(.28,.008,.7);coin.level=level;coin.born=this.elapsed;coin.merging=false;this.coins.add(coin);return coin}
 drop(){if(state.paused||state.over||this.elapsed<this.readyAt)return;const level=state.current;this.spawn(level,this.clampAim(),43);state.unlocked.add(level);this.readyAt=this.elapsed+620;state.current=state.next;state.next=this.randomLevel();updateHud()}
 clampAim(){const r=SCHOOLS[state.current].radius;return Phaser.Math.Clamp(state.aim,r+8,432-r)}
 merge(){const queue=this.merges.splice(0);for(const [a,b]of queue){if(!a.active||!b.active)continue;const level=a.level,x=(a.x+b.x)/2,y=(a.y+b.y)/2;a.destroy();b.destroy();this.coins.delete(a);this.coins.delete(b);const target=Math.min(level+1,10);state.score+=level===10?4096:2**(level+1);tone(target);if(level<10){const coin=this.spawn(target,x,y);coin.setVelocity(0,-1.2);if(!state.unlocked.has(target)){state.unlocked.add(target);toast('点亮新大学 · '+SCHOOLS[target].name)}if(target===10&&!state.won){state.won=true;this.time.delayedCall(650,()=>{if(!state.over)dialog('win')})}}
   else toast('双重大工！校徽消除 +4096');this.burst(x,y,SCHOOLS[target].color);updateHud();}}
 burst(x,y,color){const ring=this.add.circle(x,y,18,0xffffff,0).setStrokeStyle(3,Phaser.Display.Color.HexStringToColor(color).color).setDepth(8);this.tweens.add({targets:ring,scale:3,alpha:0,duration:390,onComplete:()=>ring.destroy()});for(let i=0;i<9;i++){const a=Math.random()*Math.PI*2,dot=this.add.circle(x,y,2+Math.random()*2,Phaser.Display.Color.HexStringToColor(color).color).setDepth(8);this.tweens.add({targets:dot,x:x+Math.cos(a)*65,y:y+Math.sin(a)*65,alpha:0,duration:450,onComplete:()=>dot.destroy()})}}
 update(time,delta){if(state.paused||state.over)return;const dt=Math.min(delta,40);this.elapsed+=dt;this.merge();if(this.keys.ArrowLeft)state.aim-=dt*.33;if(this.keys.ArrowRight)state.aim+=dt*.33;const x=this.clampAim(),r=SCHOOLS[state.current].radius;this.ghost.setTexture('seal'+state.current).setDisplaySize(r*2,r*2).setPosition(x,43).setVisible(this.elapsed>=this.readyAt);this.guide.clear();if(this.elapsed>=this.readyAt){this.guide.lineStyle(1,0x9ca98b,.45);for(let y=82;y<553;y+=12)this.guide.lineBetween(x,y,x,y+4)}
  const threatened=[...this.coins].some(c=>c.active&&this.elapsed-c.born>2400&&c.y-SCHOOLS[c.level].radius<110&&c.body.speed<1.5);
  this.danger=threatened?this.danger+dt:0;this.line.clear();this.line.lineStyle(1,threatened?0xc77561:0xa9b295,threatened?.9:.5);for(let k=14;k<430;k+=12)this.line.lineBetween(k,110,k+6,110);
  $('status').textContent=threatened?'即将越线！快找机会合成':'点击投下一枚校徽';if(this.danger>2300){state.over=true;this.ghost.setVisible(false);dialog('over')}
 }
}
const game=new Phaser.Game({type:Phaser.CANVAS,width:440*RENDER_SCALE,height:570*RENDER_SCALE,parent:'game',transparent:true,physics:{default:'matter',matter:{gravity:{y:1.15},enableSleeping:true}},scene:CampusScene,render:{antialias:true},input:{keyboard:{capture:[32,37,39]}},audio:{noAudio:true}});
$('pause').onclick=()=>{if(!state.over)state.paused?resume():dialog('pause')};$('continue').onclick=resume;$('over-restart').onclick=()=>scene.reset();$('restart').onclick=()=>{if(!state.over&&!state.paused&&state.score>0){dialog('pause');$('overlay-title').textContent='要开始新的一局吗？';$('overlay-text').textContent='点击下方「重新开始」清空本局，个人最佳会保留。'}else scene.reset()};$('sound').onclick=()=>{state.sound=!state.sound;$('sound').textContent='音效 · '+(state.sound?'开':'关');if(state.sound)tone(2)};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&scene&&!state.paused&&!state.over)dialog('pause')});
// Explicit development-only interface for deterministic real-physics smoke tests.
if(new URLSearchParams(location.search).has('test'))window.campusTest={state,schools:SCHOOLS,get scene(){return scene},spawn:(...args)=>scene.spawn(...args),reset:()=>scene.reset()};
