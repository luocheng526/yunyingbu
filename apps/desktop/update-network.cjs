const {Readable} = require('node:stream');

function createUpdateFetch(net) {
  return (url,options={}) => {
    if(options.redirect!=='manual') return net.fetch(url,options);
    // Electron net.fetch cancels manual redirects. Expose each redirect to the
    // update policy before issuing the next request, without forwarding cookies.
    return new Promise((resolve,reject)=>{
      const request=net.request({url,method:'GET',redirect:'manual',credentials:'omit',useSessionCookies:false,cache:'no-store'});
      let response;
      const abort=()=>{request.abort();const error=options.signal?.reason||new Error('Download cancelled');response?.destroy(error);reject(error);};
      request.on('error',error=>{response?.destroy(error);reject(error);});
      request.on('close',()=>options.signal?.removeEventListener('abort',abort));
      request.on('redirect',(status,_method,next)=>{
        resolve(new Response(null,{status,headers:{location:next}}));
        request.abort();
      });
      request.on('response',message=>{
        response=message;
        message.on('aborted',()=>message.destroy(new Error('Download interrupted')));
        const headers=new Headers();
        for(const [key,value] of Object.entries(message.headers)) if(value!=null) headers.set(key,Array.isArray(value)?value.join(', '):String(value));
        resolve(new Response([204,205,304].includes(message.statusCode)?null:Readable.toWeb(message),{status:message.statusCode,headers}));
      });
      if(options.signal?.aborted){abort();return;}
      options.signal?.addEventListener('abort',abort,{once:true});
      request.end();
    });
  };
}
module.exports={createUpdateFetch};
