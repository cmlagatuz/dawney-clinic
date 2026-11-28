"""Fixed destination relays; no arbitrary target or HTTP response fabrication."""
import asyncio
import ssl
import sys
from pathlib import Path

async def pipe(reader,writer):
    while data:=await reader.read(65536):
        writer.write(data)
        await writer.drain()

async def bridge(reader,writer,connect):
    tasks=[]
    other=None
    try:
        remote,other=await connect()
        tasks=[asyncio.create_task(pipe(reader,other)),asyncio.create_task(pipe(remote,writer))]
        await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
    except (OSError,asyncio.IncompleteReadError,ssl.SSLError):
        pass
    finally:
        for task in tasks: task.cancel()
        for w in (writer,other):
            if w is not None: w.close()
        await asyncio.gather(*tasks,return_exceptions=True)

async def main():
    mode=sys.argv[1]
    work=Path(sys.argv[2])
    if mode=="host":
        # Unix sockets inside private runner directory only.
        api=await asyncio.start_unix_server(
            lambda r,w:bridge(r,w,lambda:asyncio.open_connection("127.0.0.1",54321)),path=work/"api.sock")
        mail=await asyncio.start_unix_server(
            lambda r,w:bridge(r,w,lambda:asyncio.open_connection("127.0.0.1",54324)),path=work/"mail.sock")
        servers=[api,mail]
    elif mode=="namespace":
        def ctx(name):
            context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version=ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(work/(name+".crt"),work/(name+".key"))
            return context
        api=await asyncio.start_server(lambda r,w:bridge(r,w,lambda:asyncio.open_unix_connection(work/"api.sock")),"127.0.0.1",443,ssl=ctx("leaf"))
        # Deliberately wrong SAN, same CA, for mandatory TLS negative control.
        wrong=await asyncio.start_server(lambda r,w:bridge(r,w,lambda:asyncio.open_unix_connection(work/"api.sock")),"127.0.0.1",4443,ssl=ctx("wrong"))
        mail=await asyncio.start_server(lambda r,w:bridge(r,w,lambda:asyncio.open_unix_connection(work/"mail.sock")),"127.0.0.1",54324)
        servers=[api,wrong,mail]
    else: raise SystemExit("invalid relay mode")
    print("RELAY_READY",flush=True)
    await asyncio.gather(*(s.serve_forever() for s in servers))

if __name__=="__main__":
    asyncio.run(main())
