import { SSLApp, us_listen_socket_close } from 'uWebSockets.js'
import fs from 'fs'
const cert = process.argv[2], key = process.argv[3]
if(cert) fs.watch(cert, () => fs.readFile(cert, (err, cr) => {
	if(err) return
	const sock = new TLSSocket(null, {cert: cr})
	const {subject: {CN}, valid_to} = sock.getCertificate()
	server.removeServerName(CN)
	server.addServerName(CN, {key_file_name: key, cert_file_name: cert})
}))
let other = null
const server = SSLApp({key_file_name: key, cert_file_name: cert}).ws('/*', {
	upgrade(res, req, c){
		res.upgrade({other: decodeURI(req.getUrl().slice(1)), rl: 0},
			req.getHeader('sec-websocket-key'),
			req.getHeader('sec-websocket-protocol'),
			req.getHeader('sec-websocket-extensions'),
			c
		)
	},
	open(ws){
		if(other){
			/*const a = new Int32Array(ws.getRemoteAddress()), b = new Int32Array(other.getRemoteAddress())
			if((a.length === 1 && b.length === 1 && a[0] === b[0]) || (a.length === 4 && b.length === 4 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3])){
				other.end(1002)
				other = ws
				return
			}*/
			other.send(ws.other, false)
			ws.send(other.other, false)
			ws.other = other
			other.other = ws
			other = null
		}else other = ws
	},
	message(ws, buf, isBinary){
		const t = performance.now()
		const nw = Math.max(ws.rl, t-4000) + buf.byteLength/25
		if(nw > t) return
		ws.rl = nw
		if(typeof ws.other === 'string') return
		ws.other.send(buf, isBinary)
	},
	close(ws){
		if(ws === other){
			other = null
			return
		}else if(typeof ws.other === 'string') return
		ws.other.other = ''
		ws.other.end(1001)
	}
}).listen(+process.argv[4]||81, lS => {
	console.log('Listening on', +process.argv[4]||81)
	process.once('SIGINT', () => {us_listen_socket_close(lS); console.log('ws server closed')})
})