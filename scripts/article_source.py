"""공개 기사 원문만 읽고 본문은 발행 파일에 남기지 않아요."""
import hashlib, ipaddress, json, re, socket, urllib.parse, urllib.request

def public_url(url):
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None,80,443):
        raise ValueError('공개 웹 주소만 읽을 수 있어요.')
    for info in socket.getaddrinfo(parsed.hostname,parsed.port or (443 if parsed.scheme=='https' else 80),type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError('내부 네트워크 주소는 읽지 않아요.')
    return url

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        public_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def resolve(url):
    if urllib.parse.urlsplit(url).hostname=='news.google.com':
        from googlenewsdecoder import gnewsdecoder
        result=gnewsdecoder(url)
        if not result.get('status',result.get('success')):
            raise ValueError('원문 링크 복원에 실패했어요.')
        url=result['decoded_url']
    return public_url(url)

def overlap(a,b):
    def grams(s):
        s=re.sub(r'[^가-힣a-z0-9]','',s.lower());return {s[i:i+2] for i in range(len(s)-1)}
    x,y=grams(a),grams(b)
    return len(x&y)/max(1,min(len(x),len(y)))

def enrich(item):
    result=dict(item)
    try:
        import trafilatura
        direct=resolve(item['link'])
        request=urllib.request.Request(direct,headers={'User-Agent':'Mozilla/5.0 (AML-Insight/1.0)','Accept':'text/html','Accept-Encoding':'identity'})
        with urllib.request.build_opener(SafeRedirect()).open(request,timeout=20) as response:
            if 'html' not in response.headers.get('Content-Type','').lower():raise ValueError('HTML 기사만 읽어요.')
            raw=response.read(2_000_001)
            if len(raw)>2_000_000:raise ValueError('본문이 너무 커요.')
            public_url(response.url)
            direct=response.url
        extracted=trafilatura.extract(raw,output_format='json',with_metadata=True,include_comments=False,include_tables=False,favor_precision=True)
        document=json.loads(extracted or '{}');body=document.get('text') or ''
        if len(body)<200 or overlap(item['t'],document.get('title') or body[:500])<.4:
            raise ValueError('동일 기사 본문인지 확인하지 못했어요.')
        result.update(link=direct,body=body[:6000],sourceHash=hashlib.sha256(body.encode()).hexdigest())
        print('원문 확인:',item.get('src','언론'),len(body),'자')
    except Exception as error:
        print('원문 확인 실패 · 제목 기준으로 제한:',type(error).__name__)
    return result
