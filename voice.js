const leFunny = `
Start the convo with a funny impression!
Try asking about their favorite drink?
Does anyone on here even touch grass?
Please do not troll :(
No yelling!
Ask them to say racecar backwards!
Is your mic plugged in?
The longest chat was 69 hours.. Can you beat that?
¿Cómo estás?
Skipping is rude!
Hey I know you don't you live over in ...
`.trim().split('\n')

export const $ = document.querySelector.bind(document)

export let muted = false, deafened = false
export const muteBtn = $('#mute')
const durationLabel = $('duration')
muteBtn.onclick = () => muted ? voiceOn() : voiceOff()
export const deafBtn = $('#deafen')
deafBtn.onclick = () => (deafened = !deafened) ? deafBtn.classList.add('active') : deafBtn.classList.remove('active')
const disconnectBtn = $('#disconnect'), skinBtn = $('#skip')
const home = $('#homepage')
disconnectBtn.onclick = leaveSession
skinBtn.onclick = joinSession
const usernameInput = $('#username')
usernameInput.value = localStorage.name || ''
const chat = $('#chat-message')
const chatInput = $('#chat-input')
chatInput.onkeydown = (e) => {
	if(!conn || e.keyCode != 13) return
	addChatMsg(localStorage.name || 'you', chatInput.value)
	w.send(chatInput.value)
	chatInput.value = ''
}
let chatHideTimeout = -1
$('#join').onclick = joinSession

function addChatMsg(name, msg){
	chat.style.opacity = '1'
	chat.setAttribute('data-name', name)
	chat.textContent = msg
	clearTimeout(chatHideTimeout)
	chatHideTimeout = setTimeout(() => chat.style.opacity = 0, 8000)
}

const actx = new AudioContext({sampleRate: 22050})

const Q = 1024
const outLookup = new Uint8Array(Q*2), inLookup = new Float32Array(256)
const outFilter = i => Math.sqrt(Math.abs(i))*Math.sign(i)
const inFilter = i => Math.abs(i)*i
for(let i = 0; i < Q*2; i++)
	outLookup[i] = Math.round(outFilter(i/Q-1)*128+128)
for(let i = 0; i < 256; i++)
	inLookup[i] = inFilter(i/128-1)
//const test = v => inLookup[outLookup[Math.min(Q*2-1, Math.max(0, Math.floor(v*Q+Q)))]]

let m = null
let lastI = 0
export let lastJ = 0
const sounds = new Map()
const playSound = src => {
	const s = sounds.get(src)
	if(s instanceof Promise) return
	if(!s) return sounds.set(src, fetch(src).then(v => v.arrayBuffer()).then(v => actx.decodeAudioData(v, buf => {
		sounds.set(src, buf)
		playSound(src)
	})))
	const n = actx.createBufferSource()
	n.buffer = s
	n.connect(actx.destination)
	n.start()
}
async function voiceOn(){
	muted = false
	muteBtn.classList.remove('active')
	if(m == null) try{
		m = 0
		m = await navigator.mediaDevices.getUserMedia({audio: {
			//echoCancellation: false, noiseSuppression: false, 
		}})
		let node, ctx = actx, sampleRate = 22050
		// Firefox, wtf??? https://bugzilla.mozilla.org/show_bug.cgi?id=1388586
		try{ node = actx.createMediaStreamSource(m) }catch(e){
			for(sampleRate of [8000, 16000, 32000, 44100, 48000]) try{
				ctx = new AudioContext({sampleRate})
				node = ctx.createMediaStreamSource(m)
				break
			}catch(e){}
		}
		if(!node) throw "Please switch to chrome or safari, your browser does not support analyzing microphone input"
		let bufferSize = 2048, r = null
		if(sampleRate !== 22050){
			bufferSize = 2**Math.round(Math.log2(sampleRate/10))
			const {resampler} = await import('./resampler.js')
			r = resampler(sampleRate, 22050, 1, bufferSize)
		}
		m.a = ctx.createScriptProcessor(bufferSize, 1, 1)
		node.connect(m.a)
		m.a.onaudioprocess = ({inputBuffer}) => {
			const f32 = r ? r(inputBuffer.getChannelData(0)) : inputBuffer.getChannelData(0)
			const arr = new Uint8Array(f32.length)
			for(let i = 0; i < f32.length; i++) arr[i] = outLookup[Math.min(Q*2-1, Math.max(0, Math.floor(f32[i]*Q+Q)))]
			const d = pako.deflateRaw(arr)
			if(w && w.readyState == w.OPEN && !muted){
				if(conn) w.send(d)
				else queuePlay(arr)
			}
			const t = now()+1
			const len = t-lastI
			for(let j = 0; j < len; j++)
				outBuffer[(lastI+j+3)%150] = Math.round(Math.abs(f32[Math.round(j/len*f32.length)])*2000)
			lastI = t
		}
		m.a.connect(ctx.destination)
		/*m.a = actx.createAnalyser()
		m.a.fftSize = 16384
		m.a.smoothingTimeConstant = 0
		let last = actx.currentTime
		m.i = setInterval(() => {
			const dt = Math.round((last - (last=actx.currentTime))*-22050)
			const arr = new Uint8Array(dt)
			m.a.getByteTimeDomainData(arr)
			const d = pako.deflateRaw(arr)
			if(w && w.readyState == w.OPEN && !muted) w.send(d)
			const t = now()+1
			const len = t-lastI
			for(let j = 0; j < len; j++)
				outBuffer[(lastI+j+3)%150] = Math.round(Math.abs(arr[Math.round(j/len*arr.length)]/128-1)*2000)
			lastI = t
		}, 190)*/
		lastI = now()+1
	}catch(e){ console.error(e); voiceOff() }
}
function voiceOff(){
	muted = true
	muteBtn.classList.add('active')
}
const speakinginfo = $('#speakinginfo'), speaking = $('#speaking'), voiceIn = $('#voice-in')
voiceIn.style.opacity = .4
let w = null
export let conn = false
export let sessionLength = 0
export let otherName = ""
export const incSessionLength = dt => sessionLength += dt
export function joinSession(){
	chatInput.disabled = true
	skinBtn.textContent = 'Skip'
	skinBtn.style.visibility = 'hidden'
	if(w) leaveSession()
	w = new WebSocket((localStorage.server || 'ws'+location.protocol.slice(4)+'//server.'+location.hostname+':81') + '/' + encodeURI(localStorage.name || 'anonymous'))
	w.binaryType = 'arraybuffer'
	w.onopen = () => speaking.innerHTML = '<img style="filter:invert(1);mix-blend-mode:plus-lighter" src=https://upload.wikimedia.org/wikipedia/commons/c/c1/Animated_loading_half-circle.gif /> Waiting for another person...<div style="font-size:.4em;opacity:.7">Tip: leave the tab open and we\'ll play a sound once you\'re connected!</div>'
	lastJ = 0
	speakinginfo.textContent = leFunny[Math.floor(Math.random() * leFunny.length)]
	speaking.textContent = 'Connecting...'
	home.hidden = true
	w.onmessage = ({data}) => {
		if(typeof data === 'string' && !conn){
			conn = true
			playSound('/img/connect.mp3')
			document.title = 'Speaking to '+data
			chatInput.disabled = false
			voiceIn.style.opacity = 1
			speakinginfo.textContent = 'You\'re speaking to'
			speaking.textContent = otherName = data
			skinBtn.style.visibility = ''
			return
		}else if(typeof data === 'string'){
			if(data.length > 300) return
			addChatMsg(otherName, data)
			return
		}
		const arr = pako.inflateRaw(data)
		if(!lastJ) lastJ = now()+1
		if(!arr.length) return
		queuePlay(arr)
	}
	w.onclose = ({code}) => {
		playSound('/img/disconnect.mp3')
		w = null
		cleanupSession()
		speakinginfo.textContent = 'Call ended'
		if(code === 1001){
			speaking.textContent = 'Person has disconnected'
		}else if(code === 1002){
			speaking.textContent = 'Session moved'
		}else{
			speaking.textContent = 'Connection failed'
		}
	}
	voiceOn()
}
function cleanupSession(){
	conn = false
	document.title = 'Lamda'
	chatInput.disabled = true
	voiceIn.style.opacity = .4
	inBuffer.fill(0)
	sessionLength = 0
	skinBtn.textContent = 'Next'
	skinBtn.style.visibility = ''
	if(w){
		w.onclose = null
		w.close(); w = null
	}
}
export function leaveSession(){
	voiceOff()
	cleanupSession()
	home.hidden = false
	if(m){
		m.a.disconnect()
		if('i' in m) clearInterval(m.i)
		m = null
	}
}
let bufferEnd = 0
function queuePlay(data){
	const t = now()+1
	let len = t-lastJ
	if(len > 6) lastJ += len-6, len = 6
	const f32 = new Float32Array(data.length)
	for(let i = 0; i < f32.length; i++) f32[i] = inLookup[data[i]]
	for(let j = 0; j < len; j++)
		inBuffer[(lastJ+j+3)%150] = Math.round(Math.abs(f32[Math.round(j/len*f32.length)])*2000)
	lastJ = t
	if(deafened) return
	const b = actx.createBuffer(1, f32.length, 22050)
	b.copyToChannel(f32, 0)
	const n = actx.createBufferSource()
	n.buffer = b
	n.connect(actx.destination)
	if(bufferEnd < actx.currentTime || actx.state != 'running' || bufferEnd > actx.currentTime + 10) bufferEnd = actx.currentTime
	n.start(bufferEnd)
	if(bufferEnd - actx.currentTime > 0.5) n.playbackRate.value = 1.25
	bufferEnd += (f32.length/22050) / n.playbackRate.value
}

export const inBuffer = new Uint8Array(150)
export const outBuffer = new Uint8Array(150)

export const now = () => Math.floor(Date.now()/50)


document.onkeypress = e => void(home.hidden && document.activeElement === document.body && (
	e.code === 'KeyS' ? skinBtn.style.visibility || skinBtn.click()
: e.code === 'KeyD' ? disconnectBtn.click()
: e.code === 'KeyN' ? deafBtn.click()
: e.code === 'KeyM' ? muteBtn.click()
: e.code === 'Enter' && chatInput.focus()))