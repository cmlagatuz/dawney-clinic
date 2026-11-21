// CLOUD: test-only local Vite process, separate from each other profile.
// Never calls a hosted provider or starts a deployment. Only loopback binds.
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
await vite.listen()
const port=vite.httpServer.address()?.port
if(!Number.isInteger(port)||port<=0)process.exit(1)
process.send?.({port})
process.on('message',async value=>{
  if(value==='close'){
    await vite.close()
    process.exit(0)
  }
})
