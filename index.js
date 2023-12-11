import { inBuffer, joinSession, now, outBuffer, muteBtn, $, muted, sessionLength, incSessionLength, conn, lastJ } from "./voice.js"

const inGram = $('#in-gram'), outGram = $('#out-gram'), home = $('#homepage')
const inCtx = inGram.getContext('2d'), outCtx = outGram.getContext('2d')
const durationLabel = $("#duration")

let lastFrame = performance.now()/1000
requestAnimationFrame(function drawGrams(){
	const nw = performance.now()/1000, dt = nw-lastFrame
	lastFrame = nw
	requestAnimationFrame(drawGrams)
	const d = devicePixelRatio
	inGram.height = outGram.height = d*40
	const w = Math.min(150, Math.floor(inGram.offsetWidth/4))
	inGram.width = outGram.width = inGram.offsetWidth*d
	inCtx.fillStyle = '#fff8'
	inCtx.scale(-d, -d); inCtx.translate(w*-4, -40)
	outCtx.scale(-d, -d); outCtx.translate(w*-4, -40)
	const idx = now()
	for(let i = 0; i < w; i++){
		const value = inBuffer[(idx - i + 150) % 150]*.15+2
		inCtx.fillRect(i*4, 20-value/2, 3, value)
	}
	outCtx.fillStyle = muted ? '#fff3' : '#fff8'
	for(let i = 0; i < w; i++){
		const value = outBuffer[(idx - i + 150) % 150]*.15+2
		outCtx.fillRect(i*4, 20-value/2, 3, value)
	}
	durationLabel.textContent = formatDur(conn ? incSessionLength(dt) : sessionLength)
	const t = now()+1
	const len = Math.min(150, t-lastJ)
	for(let j = 0; j < len; j++)
		inBuffer[(lastJ+j+3)%150] = 0
})
function formatDur(t){
	return Math.floor(t/60)+(t%60<10?':0':':')+Math.floor(t%60)
}