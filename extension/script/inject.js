var inject = function() {
    String.prototype.hashCode = function() {
        var hash = 0, i, chr;
        if (this.length === 0) return hash;
        for (i = 0; i < this.length; i++) {
          chr   = this.charCodeAt(i);
          hash  = ((hash << 5) - hash) + chr;
          hash |= 0; // Convert to 32bit integer
        }
        return hash;
      };

    var UPNG = {};

	UPNG.toRGBA8 = function(out)
	{
		var w = out.width, h = out.height;
		if(out.tabs.acTL==null) return [UPNG.toRGBA8.decodeImage(out.data, w, h, out).buffer];

		var frms = [];
		if(out.frames[0].data==null) out.frames[0].data = out.data;
		
		var len = w*h*4, img = new Uint8Array(len), empty = new Uint8Array(len), prev=new Uint8Array(len);
		for(var i=0; i<out.frames.length; i++)
		{
			var frm = out.frames[i];
			var fx=frm.rect.x, fy=frm.rect.y, fw = frm.rect.width, fh = frm.rect.height;
			var fdata = UPNG.toRGBA8.decodeImage(frm.data, fw,fh, out);
			
			if(i!=0) for(var j=0; j<len; j++) prev[j]=img[j];

			if     (frm.blend==0) UPNG._copyTile(fdata, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.blend==1) UPNG._copyTile(fdata, fw, fh, img, w, h, fx, fy, 1);
			
			frms.push(img.buffer.slice(0));
			
			if     (frm.dispose==0) {}
			else if(frm.dispose==1) UPNG._copyTile(empty, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.dispose==2) for(var j=0; j<len; j++) img[j]=prev[j];
		}
		return frms;
	}
	UPNG.toRGBA8.decodeImage = function(data, w, h, out)
	{
		var area = w*h, bpp = UPNG.decode._getBPP(out);
		var bpl = Math.ceil(w*bpp/8);	// bytes per line

		var bf = new Uint8Array(area*4), bf32 = new Uint32Array(bf.buffer);
		var ctype = out.ctype, depth = out.depth;
		var rs = UPNG._bin.readUshort;

		//console.log(ctype, depth);
		var time = Date.now();

		if     (ctype==6) { // RGB + alpha
			var qarea = area<<2;
			if(depth== 8) for(var i=0; i<qarea;i+=4) {  bf[i] = data[i];  bf[i+1] = data[i+1];  bf[i+2] = data[i+2];  bf[i+3] = data[i+3]; }
			if(depth==16) for(var i=0; i<qarea;i++ ) {  bf[i] = data[i<<1];  }
		}
		else if(ctype==2) {	// RGB
			var ts=out.tabs["tRNS"];
			if(ts==null) {
				if(depth== 8) for(var i=0; i<area; i++) {  var ti=i*3;  bf32[i] = (255<<24)|(data[ti+2]<<16)|(data[ti+1]<<8)|data[ti];  }
				if(depth==16) for(var i=0; i<area; i++) {  var ti=i*6;  bf32[i] = (255<<24)|(data[ti+4]<<16)|(data[ti+2]<<8)|data[ti];  }
			}
			else {  var tr=ts[0], tg=ts[1], tb=ts[2];
				if(depth== 8) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*3;  bf32[i] = (255<<24)|(data[ti+2]<<16)|(data[ti+1]<<8)|data[ti];
					if(data[ti]   ==tr && data[ti+1]   ==tg && data[ti+2]   ==tb) bf[qi+3] = 0;  }
				if(depth==16) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*6;  bf32[i] = (255<<24)|(data[ti+4]<<16)|(data[ti+2]<<8)|data[ti];
					if(rs(data,ti)==tr && rs(data,ti+2)==tg && rs(data,ti+4)==tb) bf[qi+3] = 0;  }
			}
		}
		else if(ctype==3) {	// palette
			var p=out.tabs["PLTE"], ap=out.tabs["tRNS"], tl=ap?ap.length:0;
			//console.log(p, ap);
			if(depth==1) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>3)]>>(7-((i&7)<<0)))& 1), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==2) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>2)]>>(6-((i&3)<<1)))& 3), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==4) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>1)]>>(4-((i&1)<<2)))&15), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==8) for(var i=0; i<area; i++ ) {  var qi=i<<2, j=data[i]                      , cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
		}
		else if(ctype==4) {	// gray + alpha
			if(depth== 8)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<1, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+1];  }
			if(depth==16)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<2, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+2];  }
		}
		else if(ctype==0) {	// gray
			var tr = out.tabs["tRNS"] ? out.tabs["tRNS"] : -1;
			for(var y=0; y<h; y++) {
				var off = y*bpl, to = y*w;
				if     (depth== 1) for(var x=0; x<w; x++) {  var gr=255*((data[off+(x>>>3)]>>>(7 -((x&7)   )))& 1), al=(gr==tr*255)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 2) for(var x=0; x<w; x++) {  var gr= 85*((data[off+(x>>>2)]>>>(6 -((x&3)<<1)))& 3), al=(gr==tr* 85)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 4) for(var x=0; x<w; x++) {  var gr= 17*((data[off+(x>>>1)]>>>(4 -((x&1)<<2)))&15), al=(gr==tr* 17)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth== 8) for(var x=0; x<w; x++) {  var gr=data[off+     x], al=(gr                 ==tr)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
				else if(depth==16) for(var x=0; x<w; x++) {  var gr=data[off+(x<<1)], al=(rs(data,off+(x<<i))==tr)?0:255;  bf32[to+x]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			}
		}
		//console.log(Date.now()-time);
		return bf;
	}

	UPNG.decode = function(buff)
	{
		var data = new Uint8Array(buff), offset = 8, bin = UPNG._bin, rUs = bin.readUshort, rUi = bin.readUint;
		var out = {tabs:{}, frames:[]};
		var dd = new Uint8Array(data.length), doff = 0;	 // put all IDAT data into it
		var fd, foff = 0;	// frames
		
		var mgck = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		for(var i=0; i<8; i++) if(data[i]!=mgck[i]) throw "The input is not a PNG file!";

		while(offset<data.length)
		{
			var len  = bin.readUint(data, offset);  offset += 4;
			var type = bin.readASCII(data, offset, 4);  offset += 4;
			//console.log(type,len);

			if     (type=="IHDR")  {  UPNG.decode._IHDR(data, offset, out);  }
			else if(type=="CgBI")  {  out.tabs[type] = data.slice(offset,offset+4);  }
			else if(type=="IDAT") {
				for(var i=0; i<len; i++) dd[doff+i] = data[offset+i];
				doff += len;
			}
			else if(type=="acTL")  {
				out.tabs[type] = {  num_frames:rUi(data, offset), num_plays:rUi(data, offset+4)  };
				fd = new Uint8Array(data.length);
			}
			else if(type=="fcTL")  {
				if(foff!=0) {  var fr = out.frames[out.frames.length-1];
					fr.data = UPNG.decode._decompress(out, fd.slice(0,foff), fr.rect.width, fr.rect.height);  foff=0;
				}
				var rct = {x:rUi(data, offset+12),y:rUi(data, offset+16),width:rUi(data, offset+4),height:rUi(data, offset+8)};
				var del = rUs(data, offset+22);  del = rUs(data, offset+20) / (del==0?100:del);
				var frm = {rect:rct, delay:Math.round(del*1000), dispose:data[offset+24], blend:data[offset+25]};
				//console.log(frm);
				out.frames.push(frm);
			}
			else if(type=="fdAT") {
				for(var i=0; i<len-4; i++) fd[foff+i] = data[offset+i+4];
				foff += len-4;
			}
			else if(type=="pHYs") {
				out.tabs[type] = [bin.readUint(data, offset), bin.readUint(data, offset+4), data[offset+8]];
			}
			else if(type=="cHRM") {
				out.tabs[type] = [];
				for(var i=0; i<8; i++) out.tabs[type].push(bin.readUint(data, offset+i*4));
			}
			else if(type=="tEXt" || type=="zTXt") {
				if(out.tabs[type]==null) out.tabs[type] = {};
				var nz = bin.nextZero(data, offset);
				var keyw = bin.readASCII(data, offset, nz-offset);
				var text, tl=offset+len-nz-1;
				if(type=="tEXt") text = bin.readASCII(data, nz+1, tl);
				else {
					var bfr = UPNG.decode._inflate(data.slice(nz+2,nz+2+tl));
					text = bin.readUTF8(bfr,0,bfr.length);
				}
				out.tabs[type][keyw] = text;
			}
			else if(type=="iTXt") {
				if(out.tabs[type]==null) out.tabs[type] = {};
				var nz = 0, off = offset;
				nz = bin.nextZero(data, off);
				var keyw = bin.readASCII(data, off, nz-off);  off = nz + 1;
				var cflag = data[off], cmeth = data[off+1];  off+=2;
				nz = bin.nextZero(data, off);
				var ltag = bin.readASCII(data, off, nz-off);  off = nz + 1;
				nz = bin.nextZero(data, off);
				var tkeyw = bin.readUTF8(data, off, nz-off);  off = nz + 1;
				var text, tl=len-(off-offset);
				if(cflag==0) text  = bin.readUTF8(data, off, tl);
				else {
					var bfr = UPNG.decode._inflate(data.slice(off,off+tl));
					text = bin.readUTF8(bfr,0,bfr.length);
				}
				out.tabs[type][keyw] = text;
			}
			else if(type=="PLTE") {
				out.tabs[type] = bin.readBytes(data, offset, len);
			}
			else if(type=="hIST") {
				var pl = out.tabs["PLTE"].length/3;
				out.tabs[type] = [];  for(var i=0; i<pl; i++) out.tabs[type].push(rUs(data, offset+i*2));
			}
			else if(type=="tRNS") {
				if     (out.ctype==3) out.tabs[type] = bin.readBytes(data, offset, len);
				else if(out.ctype==0) out.tabs[type] = rUs(data, offset);
				else if(out.ctype==2) out.tabs[type] = [ rUs(data,offset),rUs(data,offset+2),rUs(data,offset+4) ];
				//else console.log("tRNS for unsupported color type",out.ctype, len);
			}
			else if(type=="gAMA") out.tabs[type] = bin.readUint(data, offset)/100000;
			else if(type=="sRGB") out.tabs[type] = data[offset];
			else if(type=="bKGD")
			{
				if     (out.ctype==0 || out.ctype==4) out.tabs[type] = [rUs(data, offset)];
				else if(out.ctype==2 || out.ctype==6) out.tabs[type] = [rUs(data, offset), rUs(data, offset+2), rUs(data, offset+4)];
				else if(out.ctype==3) out.tabs[type] = data[offset];
			}
			else if(type=="IEND") {
				break;
			}
			//else {  log("unknown chunk type", type, len);  }
			offset += len;
			var crc = bin.readUint(data, offset);  offset += 4;
		}
		if(foff!=0) {  var fr = out.frames[out.frames.length-1];
			fr.data = UPNG.decode._decompress(out, fd.slice(0,foff), fr.rect.width, fr.rect.height);  foff=0;
		}	
		out.data = UPNG.decode._decompress(out, dd, out.width, out.height);

		delete out.compress;  delete out.interlace;  delete out.filter;
		return out;
	}

	UPNG.decode._decompress = function(out, dd, w, h) {
		var time = Date.now();
		var bpp = UPNG.decode._getBPP(out), bpl = Math.ceil(w*bpp/8), buff = new Uint8Array((bpl+1+out.interlace)*h);
		if(out.tabs["CgBI"]) dd = UPNG.inflateRaw(dd,buff);
		else                 dd = UPNG.decode._inflate(dd,buff);
		//console.log(dd.length, buff.length);
		//console.log(Date.now()-time);

		var time=Date.now();
		if     (out.interlace==0) dd = UPNG.decode._filterZero(dd, out, 0, w, h);
		else if(out.interlace==1) dd = UPNG.decode._readInterlace(dd, out);
		//console.log(Date.now()-time);
		return dd;
	}

	UPNG.decode._inflate = function(data, buff) {  var out=UPNG["inflateRaw"](new Uint8Array(data.buffer, 2,data.length-6),buff);  return out;  }
	UPNG.inflateRaw=function(){var H={};H.H={};H.H.N=function(N,W){var R=Uint8Array,i=0,m=0,J=0,h=0,Q=0,X=0,u=0,w=0,d=0,v,C;
	if(N[0]==3&&N[1]==0)return W?W:new R(0);var V=H.H,n=V.b,A=V.e,l=V.R,M=V.n,I=V.A,e=V.Z,b=V.m,Z=W==null;
	if(Z)W=new R(N.length>>>2<<5);while(i==0){i=n(N,d,1);m=n(N,d+1,2);d+=3;if(m==0){if((d&7)!=0)d+=8-(d&7);
	var D=(d>>>3)+4,q=N[D-4]|N[D-3]<<8;if(Z)W=H.H.W(W,w+q);W.set(new R(N.buffer,N.byteOffset+D,q),w);d=D+q<<3;
	w+=q;continue}if(Z)W=H.H.W(W,w+(1<<17));if(m==1){v=b.J;C=b.h;X=(1<<9)-1;u=(1<<5)-1}if(m==2){J=A(N,d,5)+257;
	h=A(N,d+5,5)+1;Q=A(N,d+10,4)+4;d+=14;var E=d,j=1;for(var c=0;c<38;c+=2){b.Q[c]=0;b.Q[c+1]=0}for(var c=0;
	c<Q;c++){var K=A(N,d+c*3,3);b.Q[(b.X[c]<<1)+1]=K;if(K>j)j=K}d+=3*Q;M(b.Q,j);I(b.Q,j,b.u);v=b.w;C=b.d;
	d=l(b.u,(1<<j)-1,J+h,N,d,b.v);var r=V.V(b.v,0,J,b.C);X=(1<<r)-1;var S=V.V(b.v,J,h,b.D);u=(1<<S)-1;M(b.C,r);
	I(b.C,r,v);M(b.D,S);I(b.D,S,C)}while(!0){var T=v[e(N,d)&X];d+=T&15;var p=T>>>4;if(p>>>8==0){W[w++]=p}else if(p==256){break}else{var z=w+p-254;
	if(p>264){var _=b.q[p-257];z=w+(_>>>3)+A(N,d,_&7);d+=_&7}var $=C[e(N,d)&u];d+=$&15;var s=$>>>4,Y=b.c[s],a=(Y>>>4)+n(N,d,Y&15);
	d+=Y&15;while(w<z){W[w]=W[w++-a];W[w]=W[w++-a];W[w]=W[w++-a];W[w]=W[w++-a]}w=z}}}return W.length==w?W:W.slice(0,w)};
	H.H.W=function(N,W){var R=N.length;if(W<=R)return N;var V=new Uint8Array(R<<1);V.set(N,0);return V};
	H.H.R=function(N,W,R,V,n,A){var l=H.H.e,M=H.H.Z,I=0;while(I<R){var e=N[M(V,n)&W];n+=e&15;var b=e>>>4;
	if(b<=15){A[I]=b;I++}else{var Z=0,m=0;if(b==16){m=3+l(V,n,2);n+=2;Z=A[I-1]}else if(b==17){m=3+l(V,n,3);
	n+=3}else if(b==18){m=11+l(V,n,7);n+=7}var J=I+m;while(I<J){A[I]=Z;I++}}}return n};H.H.V=function(N,W,R,V){var n=0,A=0,l=V.length>>>1;
	while(A<R){var M=N[A+W];V[A<<1]=0;V[(A<<1)+1]=M;if(M>n)n=M;A++}while(A<l){V[A<<1]=0;V[(A<<1)+1]=0;A++}return n};
	H.H.n=function(N,W){var R=H.H.m,V=N.length,n,A,l,M,I,e=R.j;for(var M=0;M<=W;M++)e[M]=0;for(M=1;M<V;M+=2)e[N[M]]++;
	var b=R.K;n=0;e[0]=0;for(A=1;A<=W;A++){n=n+e[A-1]<<1;b[A]=n}for(l=0;l<V;l+=2){I=N[l+1];if(I!=0){N[l]=b[I];
	b[I]++}}};H.H.A=function(N,W,R){var V=N.length,n=H.H.m,A=n.r;for(var l=0;l<V;l+=2)if(N[l+1]!=0){var M=l>>1,I=N[l+1],e=M<<4|I,b=W-I,Z=N[l]<<b,m=Z+(1<<b);
	while(Z!=m){var J=A[Z]>>>15-W;R[J]=e;Z++}}};H.H.l=function(N,W){var R=H.H.m.r,V=15-W;for(var n=0;n<N.length;
	n+=2){var A=N[n]<<W-N[n+1];N[n]=R[A]>>>V}};H.H.M=function(N,W,R){R=R<<(W&7);var V=W>>>3;N[V]|=R;N[V+1]|=R>>>8};
	H.H.I=function(N,W,R){R=R<<(W&7);var V=W>>>3;N[V]|=R;N[V+1]|=R>>>8;N[V+2]|=R>>>16};H.H.e=function(N,W,R){return(N[W>>>3]|N[(W>>>3)+1]<<8)>>>(W&7)&(1<<R)-1};
	H.H.b=function(N,W,R){return(N[W>>>3]|N[(W>>>3)+1]<<8|N[(W>>>3)+2]<<16)>>>(W&7)&(1<<R)-1};H.H.Z=function(N,W){return(N[W>>>3]|N[(W>>>3)+1]<<8|N[(W>>>3)+2]<<16)>>>(W&7)};
	H.H.i=function(N,W){return(N[W>>>3]|N[(W>>>3)+1]<<8|N[(W>>>3)+2]<<16|N[(W>>>3)+3]<<24)>>>(W&7)};H.H.m=function(){var N=Uint16Array,W=Uint32Array;
	return{K:new N(16),j:new N(16),X:[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],S:[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,999,999,999],T:[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0],q:new N(32),p:[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,65535,65535],z:[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0],c:new W(32),J:new N(512),_:[],h:new N(32),$:[],w:new N(32768),C:[],v:[],d:new N(32768),D:[],u:new N(512),Q:[],r:new N(1<<15),s:new W(286),Y:new W(30),a:new W(19),t:new W(15e3),k:new N(1<<16),g:new N(1<<15)}}();
	(function(){var N=H.H.m,W=1<<15;for(var R=0;R<W;R++){var V=R;V=(V&2863311530)>>>1|(V&1431655765)<<1;
	V=(V&3435973836)>>>2|(V&858993459)<<2;V=(V&4042322160)>>>4|(V&252645135)<<4;V=(V&4278255360)>>>8|(V&16711935)<<8;
	N.r[R]=(V>>>16|V<<16)>>>17}function n(A,l,M){while(l--!=0)A.push(0,M)}for(var R=0;R<32;R++){N.q[R]=N.S[R]<<3|N.T[R];
	N.c[R]=N.p[R]<<4|N.z[R]}n(N._,144,8);n(N._,255-143,9);n(N._,279-255,7);n(N._,287-279,8);H.H.n(N._,9);
	H.H.A(N._,9,N.J);H.H.l(N._,9);n(N.$,32,5);H.H.n(N.$,5);H.H.A(N.$,5,N.h);H.H.l(N.$,5);n(N.Q,19,0);n(N.C,286,0);
	n(N.D,30,0);n(N.v,320,0)}());return H.H.N}()

	UPNG.decode._readInterlace = function(data, out)
	{
		var w = out.width, h = out.height;
		var bpp = UPNG.decode._getBPP(out), cbpp = bpp>>3, bpl = Math.ceil(w*bpp/8);
		var img = new Uint8Array( h * bpl );
		var di = 0;

		var starting_row  = [ 0, 0, 4, 0, 2, 0, 1 ];
		var starting_col  = [ 0, 4, 0, 2, 0, 1, 0 ];
		var row_increment = [ 8, 8, 8, 4, 4, 2, 2 ];
		var col_increment = [ 8, 8, 4, 4, 2, 2, 1 ];

		var pass=0;
		while(pass<7)
		{
			var ri = row_increment[pass], ci = col_increment[pass];
			var sw = 0, sh = 0;
			var cr = starting_row[pass];  while(cr<h) {  cr+=ri;  sh++;  }
			var cc = starting_col[pass];  while(cc<w) {  cc+=ci;  sw++;  }
			var bpll = Math.ceil(sw*bpp/8);
			UPNG.decode._filterZero(data, out, di, sw, sh);

			var y=0, row = starting_row[pass];
			while(row<h)
			{
				var col = starting_col[pass];
				var cdi = (di+y*bpll)<<3;

				while(col<w)
				{
					if(bpp==1) {
						var val = data[cdi>>3];  val = (val>>(7-(cdi&7)))&1;
						img[row*bpl + (col>>3)] |= (val << (7-((col&7)<<0)));
					}
					if(bpp==2) {
						var val = data[cdi>>3];  val = (val>>(6-(cdi&7)))&3;
						img[row*bpl + (col>>2)] |= (val << (6-((col&3)<<1)));
					}
					if(bpp==4) {
						var val = data[cdi>>3];  val = (val>>(4-(cdi&7)))&15;
						img[row*bpl + (col>>1)] |= (val << (4-((col&1)<<2)));
					}
					if(bpp>=8) {
						var ii = row*bpl+col*cbpp;
						for(var j=0; j<cbpp; j++) img[ii+j] = data[(cdi>>3)+j];
					}
					cdi+=bpp;  col+=ci;
				}
				y++;  row += ri;
			}
			if(sw*sh!=0) di += sh * (1 + bpll);
			pass = pass + 1;
		}
		return img;
	}

	UPNG.decode._getBPP = function(out) {
		var noc = [1,null,3,1,2,null,4][out.ctype];
		return noc * out.depth;
	}

	UPNG.decode._filterZero = function(data, out, off, w, h)
	{
		var bpp = UPNG.decode._getBPP(out), bpl = Math.ceil(w*bpp/8), paeth = UPNG.decode._paeth;
		bpp = Math.ceil(bpp/8);
		
		var i=0, di=1, type=data[off], x=0;
		
		if(type>1) data[off]=[0,0,1][type-2];  
		if(type==3) for(x=bpp; x<bpl; x++) data[x+1] = (data[x+1] + (data[x+1-bpp]>>>1) )&255;

		for(var y=0; y<h; y++)  {
			i = off+y*bpl; di = i+y+1;
			type = data[di-1]; x=0;

			if     (type==0)   for(; x<bpl; x++) data[i+x] = data[di+x];
			else if(type==1) { for(; x<bpp; x++) data[i+x] = data[di+x];
							for(; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpp]);  }
			else if(type==2) { for(; x<bpl; x++) data[i+x] = (data[di+x] + data[i+x-bpl]);  }
			else if(type==3) { for(; x<bpp; x++) data[i+x] = (data[di+x] + ( data[i+x-bpl]>>>1));
							for(; x<bpl; x++) data[i+x] = (data[di+x] + ((data[i+x-bpl]+data[i+x-bpp])>>>1) );  }
			else             { for(; x<bpp; x++) data[i+x] = (data[di+x] + paeth(0, data[i+x-bpl], 0));
							for(; x<bpl; x++) data[i+x] = (data[di+x] + paeth(data[i+x-bpp], data[i+x-bpl], data[i+x-bpp-bpl]) );  }
		}
		return data;
	}

	UPNG.decode._paeth = function(a,b,c)
	{
		var p = a+b-c, pa = (p-a), pb = (p-b), pc = (p-c);
		if (pa*pa <= pb*pb && pa*pa <= pc*pc)  return a;
		else if (pb*pb <= pc*pc)  return b;
		return c;
	}

	UPNG.decode._IHDR = function(data, offset, out)
	{
		var bin = UPNG._bin;
		out.width  = bin.readUint(data, offset);  offset += 4;
		out.height = bin.readUint(data, offset);  offset += 4;
		out.depth     = data[offset];  offset++;
		out.ctype     = data[offset];  offset++;
		out.compress  = data[offset];  offset++;
		out.filter    = data[offset];  offset++;
		out.interlace = data[offset];  offset++;
	}

	UPNG._bin = {
		nextZero   : function(data,p)  {  while(data[p]!=0) p++;  return p;  },
		readUshort : function(buff,p)  {  return (buff[p]<< 8) | buff[p+1];  },
		writeUshort: function(buff,p,n){  buff[p] = (n>>8)&255;  buff[p+1] = n&255;  },
		readUint   : function(buff,p)  {  return (buff[p]*(256*256*256)) + ((buff[p+1]<<16) | (buff[p+2]<< 8) | buff[p+3]);  },
		writeUint  : function(buff,p,n){  buff[p]=(n>>24)&255;  buff[p+1]=(n>>16)&255;  buff[p+2]=(n>>8)&255;  buff[p+3]=n&255;  },
		readASCII  : function(buff,p,l){  var s = "";  for(var i=0; i<l; i++) s += String.fromCharCode(buff[p+i]);  return s;    },
		writeASCII : function(data,p,s){  for(var i=0; i<s.length; i++) data[p+i] = s.charCodeAt(i);  },
		readBytes  : function(buff,p,l){  var arr = [];   for(var i=0; i<l; i++) arr.push(buff[p+i]);   return arr;  },
		pad : function(n) { return n.length < 2 ? "0" + n : n; },
		readUTF8 : function(buff, p, l) {
			var s = "", ns;
			for(var i=0; i<l; i++) s += "%" + UPNG._bin.pad(buff[p+i].toString(16));
			try {  ns = decodeURIComponent(s); }
			catch(e) {  return UPNG._bin.readASCII(buff, p, l);  }
			return  ns;
		}
	}
	UPNG._copyTile = function(sb, sw, sh, tb, tw, th, xoff, yoff, mode)
	{
		var w = Math.min(sw,tw), h = Math.min(sh,th);
		var si=0, ti=0;
		for(var y=0; y<h; y++)
			for(var x=0; x<w; x++)
			{
				if(xoff>=0 && yoff>=0) {  si = (y*sw+x)<<2;  ti = (( yoff+y)*tw+xoff+x)<<2;  }
				else                   {  si = ((-yoff+y)*sw-xoff+x)<<2;  ti = (y*tw+x)<<2;  }

				if     (mode==0) {  tb[ti] = sb[si];  tb[ti+1] = sb[si+1];  tb[ti+2] = sb[si+2];  tb[ti+3] = sb[si+3];  }
				else if(mode==1) {
					var fa = sb[si+3]*(1/255), fr=sb[si]*fa, fg=sb[si+1]*fa, fb=sb[si+2]*fa; 
					var ba = tb[ti+3]*(1/255), br=tb[ti]*ba, bg=tb[ti+1]*ba, bb=tb[ti+2]*ba; 
					
					var ifa=1-fa, oa = fa+ba*ifa, ioa = (oa==0?0:1/oa);
					tb[ti+3] = 255*oa;  
					tb[ti+0] = (fr+br*ifa)*ioa;
					tb[ti+1] = (fg+bg*ifa)*ioa;
					tb[ti+2] = (fb+bb*ifa)*ioa;  
				}
				else if(mode==2){	// copy only differences, otherwise zero
					var fa = sb[si+3], fr=sb[si], fg=sb[si+1], fb=sb[si+2]; 
					var ba = tb[ti+3], br=tb[ti], bg=tb[ti+1], bb=tb[ti+2]; 
					if(fa==ba && fr==br && fg==bg && fb==bb) {  tb[ti]=0;  tb[ti+1]=0;  tb[ti+2]=0;  tb[ti+3]=0;  }
					else {  tb[ti]=fr;  tb[ti+1]=fg;  tb[ti+2]=fb;  tb[ti+3]=fa;  }
				}
				else if(mode==3){	// check if can be blended
					var fa = sb[si+3], fr=sb[si], fg=sb[si+1], fb=sb[si+2]; 
					var ba = tb[ti+3], br=tb[ti], bg=tb[ti+1], bb=tb[ti+2];
					if(fa==ba && fr==br && fg==bg && fb==bb) continue;
					//if(fa!=255 && ba!=0) return false;
					if(fa<220 && ba>20) return false;
				}
			}
		return true;
	}

	UPNG.encode = function(bufs, w, h, ps, dels, tabs, forbidPlte)
	{
		if(ps==null) ps=0;
		if(forbidPlte==null) forbidPlte = false;

		
		var nimg = UPNG.encode.compress(bufs, w, h, ps, [false, false, false, 0, forbidPlte]);

		UPNG.encode.compressPNG(nimg, -1);
	//	console.log(bufs, nimg);
		return UPNG.encode._main(nimg, w, h, dels, tabs);
	}

	UPNG.encodeLL = function(bufs, w, h, cc, ac, depth, dels, tabs) {
		var nimg = {  ctype: 0 + (cc==1 ? 0 : 2) + (ac==0 ? 0 : 4),      depth: depth,  frames: []  };
		
		var time = Date.now();
		var bipp = (cc+ac)*depth, bipl = bipp * w;
		for(var i=0; i<bufs.length; i++)
			nimg.frames.push({  rect:{x:0,y:0,width:w,height:h},  img:new Uint8Array(bufs[i]), blend:0, dispose:1, bpp:Math.ceil(bipp/8), bpl:Math.ceil(bipl/8)  });

		UPNG.encode.compressPNG(nimg, 0, true);
		
		var out = UPNG.encode._main(nimg, w, h, dels, tabs);
		return out;
	}

	UPNG.encode._main = function(nimg, w, h, dels, tabs) {
		if(tabs==null) tabs={};
		var crc = UPNG.crc.crc, wUi = UPNG._bin.writeUint, wUs = UPNG._bin.writeUshort, wAs = UPNG._bin.writeASCII;
		var offset = 8, anim = nimg.frames.length>1, pltAlpha = false;

		var leng = 8 + (16+5+4) /*+ (9+4)*/ + (anim ? 20 : 0);
		if(tabs["sRGB"]!=null) leng += 8+1+4;
		if(tabs["pHYs"]!=null) leng += 8+9+4;
		if(nimg.ctype==3) {
			var dl = nimg.plte.length;
			for(var i=0; i<dl; i++) if((nimg.plte[i]>>>24)!=255) pltAlpha = true;
			leng += (8 + dl*3 + 4) + (pltAlpha ? (8 + dl*1 + 4) : 0);
		}
		for(var j=0; j<nimg.frames.length; j++)
		{
			var fr = nimg.frames[j];
			if(anim) leng += 38;
			leng += fr.cimg.length + 12;
			if(j!=0) leng+=4;
		}
		leng += 12; 
		
		var data = new Uint8Array(leng);
		var wr=[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		for(var i=0; i<8; i++) data[i]=wr[i];

		wUi(data,offset, 13);     offset+=4;
		wAs(data,offset,"IHDR");  offset+=4;
		wUi(data,offset,w);  offset+=4;
		wUi(data,offset,h);  offset+=4;
		data[offset] = nimg.depth;  offset++;  // depth
		data[offset] = nimg.ctype;  offset++;  // ctype
		data[offset] = 0;  offset++;  // compress
		data[offset] = 0;  offset++;  // filter
		data[offset] = 0;  offset++;  // interlace
		wUi(data,offset,crc(data,offset-17,17));  offset+=4; // crc

		// 13 bytes to say, that it is sRGB
		if(tabs["sRGB"]!=null) {
			wUi(data,offset, 1);      offset+=4;
			wAs(data,offset,"sRGB");  offset+=4;
			data[offset] = tabs["sRGB"];  offset++;
			wUi(data,offset,crc(data,offset-5,5));  offset+=4; // crc
		}
		if(tabs["pHYs"]!=null) {
			wUi(data,offset, 9);      offset+=4;
			wAs(data,offset,"pHYs");  offset+=4;
			wUi(data,offset, tabs["pHYs"][0]);      offset+=4;
			wUi(data,offset, tabs["pHYs"][1]);      offset+=4;
			data[offset]=tabs["pHYs"][2];			offset++;
			wUi(data,offset,crc(data,offset-13,13));  offset+=4; // crc
		}

		if(anim) {
			wUi(data,offset, 8);      offset+=4;
			wAs(data,offset,"acTL");  offset+=4;
			wUi(data,offset, nimg.frames.length);     offset+=4;
			wUi(data,offset, tabs["loop"]!=null?tabs["loop"]:0);      offset+=4;
			wUi(data,offset,crc(data,offset-12,12));  offset+=4; // crc
		}

		if(nimg.ctype==3) {
			var dl = nimg.plte.length;
			wUi(data,offset, dl*3);  offset+=4;
			wAs(data,offset,"PLTE");  offset+=4;
			for(var i=0; i<dl; i++){
				var ti=i*3, c=nimg.plte[i], r=(c)&255, g=(c>>>8)&255, b=(c>>>16)&255;
				data[offset+ti+0]=r;  data[offset+ti+1]=g;  data[offset+ti+2]=b;
			}
			offset+=dl*3;
			wUi(data,offset,crc(data,offset-dl*3-4,dl*3+4));  offset+=4; // crc

			if(pltAlpha) {
				wUi(data,offset, dl);  offset+=4;
				wAs(data,offset,"tRNS");  offset+=4;
				for(var i=0; i<dl; i++)  data[offset+i]=(nimg.plte[i]>>>24)&255;
				offset+=dl;
				wUi(data,offset,crc(data,offset-dl-4,dl+4));  offset+=4; // crc
			}
		}
		
		var fi = 0;
		for(var j=0; j<nimg.frames.length; j++)
		{
			var fr = nimg.frames[j];
			if(anim) {
				wUi(data, offset, 26);     offset+=4;
				wAs(data, offset,"fcTL");  offset+=4;
				wUi(data, offset, fi++);   offset+=4;
				wUi(data, offset, fr.rect.width );   offset+=4;
				wUi(data, offset, fr.rect.height);   offset+=4;
				wUi(data, offset, fr.rect.x);   offset+=4;
				wUi(data, offset, fr.rect.y);   offset+=4;
				wUs(data, offset, dels[j]);   offset+=2;
				wUs(data, offset,  1000);   offset+=2;
				data[offset] = fr.dispose;  offset++;	// dispose
				data[offset] = fr.blend  ;  offset++;	// blend
				wUi(data,offset,crc(data,offset-30,30));  offset+=4; // crc
			}
					
			var imgd = fr.cimg, dl = imgd.length;
			wUi(data,offset, dl+(j==0?0:4));     offset+=4;
			var ioff = offset;
			wAs(data,offset,(j==0)?"IDAT":"fdAT");  offset+=4;
			if(j!=0) {  wUi(data, offset, fi++);  offset+=4;  }
			data.set(imgd,offset);
			offset += dl;
			wUi(data,offset,crc(data,ioff,offset-ioff));  offset+=4; // crc
		}

		wUi(data,offset, 0);     offset+=4;
		wAs(data,offset,"IEND");  offset+=4;
		wUi(data,offset,crc(data,offset-4,4));  offset+=4; // crc

		return data.buffer;
	}

	UPNG.encode.compressPNG = function(out, filter, levelZero) {
		for(var i=0; i<out.frames.length; i++) {
			var frm = out.frames[i], nw=frm.rect.width, nh=frm.rect.height;
			var fdata = new Uint8Array(nh*frm.bpl+nh);
			frm.cimg = UPNG.encode._filterZero(frm.img,nh,frm.bpp,frm.bpl,fdata, filter, levelZero);
		}
	}

	UPNG.encode.compress = function(bufs, w, h, ps, prms) // prms:  onlyBlend, minBits, forbidPlte
	{
		//var time = Date.now();
		var onlyBlend = prms[0], evenCrd = prms[1], forbidPrev = prms[2], minBits = prms[3], forbidPlte = prms[4];
		
		var ctype = 6, depth = 8, alphaAnd=255

		for(var j=0; j<bufs.length; j++)  {  // when not quantized, other frames can contain colors, that are not in an initial frame
			var img = new Uint8Array(bufs[j]), ilen = img.length;
			for(var i=0; i<ilen; i+=4) alphaAnd &= img[i+3];
		}
		var gotAlpha = (alphaAnd!=255);
		
		//console.log("alpha check", Date.now()-time);  time = Date.now();
		
		//var brute = gotAlpha && forGIF;		// brute : frames can only be copied, not "blended"
		var frms = UPNG.encode.framize(bufs, w, h, onlyBlend, evenCrd, forbidPrev);
		//console.log("framize", Date.now()-time);  time = Date.now();

		var cmap={}, plte=[], inds=[];
		
		if(ps!=0) {
			var nbufs = [];  for(var i=0; i<frms.length; i++) nbufs.push(frms[i].img.buffer);

			var abuf = UPNG.encode.concatRGBA(nbufs), qres = UPNG.quantize(abuf, ps);  console.log(qres);
			var cof = 0, bb = new Uint8Array(qres.abuf);
			for(var i=0; i<frms.length; i++) {  var ti=frms[i].img, bln=ti.length;  inds.push(new Uint8Array(qres.inds.buffer, cof>>2, bln>>2));
				for(var j=0; j<bln; j+=4) {  ti[j]=bb[cof+j];  ti[j+1]=bb[cof+j+1];  ti[j+2]=bb[cof+j+2];  ti[j+3]=bb[cof+j+3];  }    cof+=bln;  }
			
			for(var i=0; i<qres.plte.length; i++) plte.push(qres.plte[i].est.rgba);
			//console.log("quantize", Date.now()-time);  time = Date.now();
		}
		else {
			// what if ps==0, but there are <=256 colors?  we still need to detect, if the palette could be used
			for(var j=0; j<frms.length; j++)  {  // when not quantized, other frames can contain colors, that are not in an initial frame
				var frm = frms[j], img32 = new Uint32Array(frm.img.buffer), nw=frm.rect.width, ilen = img32.length;
				var ind = new Uint8Array(ilen);  inds.push(ind);
				for(var i=0; i<ilen; i++) {
					var c = img32[i];
					if     (i!=0 && c==img32[i- 1]) ind[i]=ind[i-1];
					else if(i>nw && c==img32[i-nw]) ind[i]=ind[i-nw];
					else {
						var cmc = cmap[c];
						if(cmc==null) {  cmap[c]=cmc=plte.length;  plte.push(c);  if(plte.length>=300) break;  }
						ind[i]=cmc;
					}
				}
			}
			//console.log("make palette", Date.now()-time);  time = Date.now();
		}

		var cc=plte.length; //console.log("colors:",cc);
		if(cc<=256 && forbidPlte==false) {
			if(cc<= 2) depth=1;  else if(cc<= 4) depth=2;  else if(cc<=16) depth=4;  else depth=8;
			depth =  Math.max(depth, minBits);
		}
		
		for(var j=0; j<frms.length; j++)
		{
			var frm = frms[j], nx=frm.rect.x, ny=frm.rect.y, nw=frm.rect.width, nh=frm.rect.height;
			var cimg = frm.img, cimg32 = new Uint32Array(cimg.buffer);
			var bpl = 4*nw, bpp=4;
			if(cc<=256 && forbidPlte==false) {
				bpl = Math.ceil(depth*nw/8);
				var nimg = new Uint8Array(bpl*nh);
				var inj = inds[j];
				for(var y=0; y<nh; y++) {  var i=y*bpl, ii=y*nw;
					if     (depth==8) for(var x=0; x<nw; x++) nimg[i+(x)   ]   =  (inj[ii+x]             );
					else if(depth==4) for(var x=0; x<nw; x++) nimg[i+(x>>1)]  |=  (inj[ii+x]<<(4-(x&1)*4));
					else if(depth==2) for(var x=0; x<nw; x++) nimg[i+(x>>2)]  |=  (inj[ii+x]<<(6-(x&3)*2));
					else if(depth==1) for(var x=0; x<nw; x++) nimg[i+(x>>3)]  |=  (inj[ii+x]<<(7-(x&7)*1));
				}
				cimg=nimg;  ctype=3;  bpp=1;
			}
			else if(gotAlpha==false && frms.length==1) {	// some next "reduced" frames may contain alpha for blending
				var nimg = new Uint8Array(nw*nh*3), area=nw*nh;
				for(var i=0; i<area; i++) { var ti=i*3, qi=i*4;  nimg[ti]=cimg[qi];  nimg[ti+1]=cimg[qi+1];  nimg[ti+2]=cimg[qi+2];  }
				cimg=nimg;  ctype=2;  bpp=3;  bpl=3*nw;
			}
			frm.img=cimg;  frm.bpl=bpl;  frm.bpp=bpp;
		}
		//console.log("colors => palette indices", Date.now()-time);  time = Date.now();

		return {ctype:ctype, depth:depth, plte:plte, frames:frms  };
	}
	UPNG.encode.framize = function(bufs,w,h,alwaysBlend,evenCrd,forbidPrev) {
		var frms = [];
		for(var j=0; j<bufs.length; j++) {
			var cimg = new Uint8Array(bufs[j]), cimg32 = new Uint32Array(cimg.buffer);
			var nimg;

			var nx=0, ny=0, nw=w, nh=h, blend=alwaysBlend?1:0;
			if(j!=0) {
				var tlim = (forbidPrev || alwaysBlend || j==1 || frms[j-2].dispose!=0)?1:2, tstp = 0, tarea = 1e9;
				for(var it=0; it<tlim; it++)
				{
					var pimg = new Uint8Array(bufs[j-1-it]), p32 = new Uint32Array(bufs[j-1-it]);
					var mix=w,miy=h,max=-1,may=-1;
					for(var y=0; y<h; y++) for(var x=0; x<w; x++) {
						var i = y*w+x;
						if(cimg32[i]!=p32[i]) {
							if(x<mix) mix=x;  if(x>max) max=x;
							if(y<miy) miy=y;  if(y>may) may=y;
						}
					}
					if(max==-1) mix=miy=max=may=0;
					if(evenCrd) {  if((mix&1)==1)mix--;  if((miy&1)==1)miy--;  }
					var sarea = (max-mix+1)*(may-miy+1);
					if(sarea<tarea) {
						tarea = sarea;  tstp = it;
						nx = mix; ny = miy; nw = max-mix+1; nh = may-miy+1;
					}
				}
				
				// alwaysBlend: pokud zjistím, že blendit nelze, nastavím předchozímu snímku dispose=1. Zajistím, aby obsahoval můj obdélník.
				var pimg = new Uint8Array(bufs[j-1-tstp]);
				if(tstp==1) frms[j-1].dispose = 2;
				
				nimg = new Uint8Array(nw*nh*4);
				UPNG._copyTile(pimg,w,h, nimg,nw,nh, -nx,-ny, 0);
				
				blend =  UPNG._copyTile(cimg,w,h, nimg,nw,nh, -nx,-ny, 3) ? 1 : 0;
				if(blend==1) UPNG.encode._prepareDiff(cimg,w,h,nimg,{x:nx,y:ny,width:nw,height:nh});
				else         UPNG._copyTile(cimg,w,h, nimg,nw,nh, -nx,-ny, 0);
				//UPNG._copyTile(cimg,w,h, nimg,nw,nh, -nx,-ny, blend==1?2:0);
			}
			else nimg = cimg.slice(0);	// img may be rewritten further ... don't rewrite input

			frms.push({rect:{x:nx,y:ny,width:nw,height:nh}, img:nimg, blend:blend, dispose:0});
		}

		
		if(alwaysBlend) for(var j=0; j<frms.length; j++) {
			var frm = frms[j];  if(frm.blend==1) continue;
			var r0 = frm.rect, r1 = frms[j-1].rect
			var miX = Math.min(r0.x, r1.x), miY = Math.min(r0.y, r1.y);
			var maX = Math.max(r0.x+r0.width, r1.x+r1.width), maY = Math.max(r0.y+r0.height, r1.y+r1.height);
			var r = {x:miX, y:miY, width:maX-miX, height:maY-miY};

			frms[j-1].dispose = 1;
			if(j-1!=0) 
			UPNG.encode._updateFrame(bufs, w,h,frms, j-1,r, evenCrd);
			UPNG.encode._updateFrame(bufs, w,h,frms, j  ,r, evenCrd);
		}
		var area = 0;
		if(bufs.length!=1) for(var i=0; i<frms.length; i++) {
			var frm = frms[i];
			area += frm.rect.width*frm.rect.height;
			//if(i==0 || frm.blend!=1) continue;
			//var ob = new Uint8Array(
			//console.log(frm.blend, frm.dispose, frm.rect);
		}
		//if(area!=0) console.log(area);
		return frms;
	}

	UPNG.encode._updateFrame = function(bufs, w,h, frms, i, r, evenCrd) {
		var U8 = Uint8Array, U32 = Uint32Array;
		var pimg = new U8(bufs[i-1]), pimg32 = new U32(bufs[i-1]), nimg = i+1<bufs.length ? new U8(bufs[i+1]):null;
		var cimg = new U8(bufs[i]), cimg32 = new U32(cimg.buffer);

		var mix=w,miy=h,max=-1,may=-1;
		for(var y=0; y<r.height; y++) for(var x=0; x<r.width; x++) {
			var cx = r.x+x, cy = r.y+y;
			var j = cy*w+cx, cc = cimg32[j];
			// no need to draw transparency, or to dispose it. Or, if writing the same color and the next one does not need transparency.
			if(cc==0 || (frms[i-1].dispose==0 && pimg32[j]==cc && (nimg==null || nimg[j*4+3]!=0))/**/) {}
			else {
				if(cx<mix) mix=cx;  if(cx>max) max=cx;
				if(cy<miy) miy=cy;  if(cy>may) may=cy;
			}
		}
		if(max==-1) mix=miy=max=may=0;
		if(evenCrd) {  if((mix&1)==1)mix--;  if((miy&1)==1)miy--;  }
		r = {x:mix, y:miy, width:max-mix+1, height:may-miy+1};

		var fr = frms[i];  fr.rect = r;  fr.blend = 1;  fr.img = new Uint8Array(r.width*r.height*4);
		if(frms[i-1].dispose==0) {
			UPNG._copyTile(pimg,w,h, fr.img,r.width,r.height, -r.x,-r.y, 0);
			UPNG.encode._prepareDiff(cimg,w,h,fr.img,r);
			//UPNG._copyTile(cimg,w,h, fr.img,r.width,r.height, -r.x,-r.y, 2);
		}
		else
			UPNG._copyTile(cimg,w,h, fr.img,r.width,r.height, -r.x,-r.y, 0);
	}
	UPNG.encode._prepareDiff = function(cimg, w,h, nimg, rec) {
		UPNG._copyTile(cimg,w,h, nimg,rec.width,rec.height, -rec.x,-rec.y, 2);
		/*
		var n32 = new Uint32Array(nimg.buffer);
		var og = new Uint8Array(rec.width*rec.height*4), o32 = new Uint32Array(og.buffer);
		UPNG._copyTile(cimg,w,h, og,rec.width,rec.height, -rec.x,-rec.y, 0);
		for(var i=4; i<nimg.length; i+=4) {
			if(nimg[i-1]!=0 && nimg[i+3]==0 && o32[i>>>2]==o32[(i>>>2)-1]) {
				n32[i>>>2]=o32[i>>>2];
				//var j = i, c=p32[(i>>>2)-1];
				//while(p32[j>>>2]==c) {  n32[j>>>2]=c;  j+=4;  }
			}
		}
		for(var i=nimg.length-8; i>0; i-=4) {
			if(nimg[i+7]!=0 && nimg[i+3]==0 && o32[i>>>2]==o32[(i>>>2)+1]) {
				n32[i>>>2]=o32[i>>>2];
				//var j = i, c=p32[(i>>>2)-1];
				//while(p32[j>>>2]==c) {  n32[j>>>2]=c;  j+=4;  }
			}
		}*/
	}

	UPNG.encode._filterZero = function(img,h,bpp,bpl,data, filter, levelZero)
	{
		var fls = [], ftry=[0,1,2,3,4];
		if     (filter!=-1)             ftry=[filter];
		else if(h*bpl>500000 || bpp==1) ftry=[0];
		var opts;  if(levelZero) opts={level:0};
		
		
		var CMPR = (data.length>10e6 && UZIP!=null) ? UZIP : pako;

		var time = Date.now();
		for(var i=0; i<ftry.length; i++) {
			for(var y=0; y<h; y++) UPNG.encode._filterLine(data, img, y, bpl, bpp, ftry[i]);
			//var nimg = new Uint8Array(data.length);
			//var sz = UZIP.F.deflate(data, nimg);  fls.push(nimg.slice(0,sz));
			//var dfl = pako["deflate"](data), dl=dfl.length-4;
			//var crc = (dfl[dl+3]<<24)|(dfl[dl+2]<<16)|(dfl[dl+1]<<8)|(dfl[dl+0]<<0);
			//console.log(crc, UZIP.adler(data,2,data.length-6));
			fls.push(CMPR["deflate"](data,opts));
		}

		var ti, tsize=1e9;
		for(var i=0; i<fls.length; i++) if(fls[i].length<tsize) {  ti=i;  tsize=fls[i].length;  }
		return fls[ti];
	}
	UPNG.encode._filterLine = function(data, img, y, bpl, bpp, type)
	{
		var i = y*bpl, di = i+y, paeth = UPNG.decode._paeth
		data[di]=type;  di++;

		if(type==0) {
			if(bpl<500) for(var x=0; x<bpl; x++) data[di+x] = img[i+x];
			else data.set(new Uint8Array(img.buffer,i,bpl),di);
		}
		else if(type==1) {
			for(var x=  0; x<bpp; x++) data[di+x] =  img[i+x];
			for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]-img[i+x-bpp]+256)&255;
		}
		else if(y==0) {
			for(var x=  0; x<bpp; x++) data[di+x] = img[i+x];

			if(type==2) for(var x=bpp; x<bpl; x++) data[di+x] = img[i+x];
			if(type==3) for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x] - (img[i+x-bpp]>>1) +256)&255;
			if(type==4) for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x] - paeth(img[i+x-bpp], 0, 0) +256)&255;
		}
		else {
			if(type==2) { for(var x=  0; x<bpl; x++) data[di+x] = (img[i+x]+256 - img[i+x-bpl])&255;  }
			if(type==3) { for(var x=  0; x<bpp; x++) data[di+x] = (img[i+x]+256 - (img[i+x-bpl]>>1))&255;
						for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]+256 - ((img[i+x-bpl]+img[i+x-bpp])>>1))&255;  }
			if(type==4) { for(var x=  0; x<bpp; x++) data[di+x] = (img[i+x]+256 - paeth(0, img[i+x-bpl], 0))&255;
						for(var x=bpp; x<bpl; x++) data[di+x] = (img[i+x]+256 - paeth(img[i+x-bpp], img[i+x-bpl], img[i+x-bpp-bpl]))&255;  }
		}
	}

	UPNG.crc = {
		table : ( function() {
		var tab = new Uint32Array(256);
		for (var n=0; n<256; n++) {
				var c = n;
				for (var k=0; k<8; k++) {
					if (c & 1)  c = 0xedb88320 ^ (c >>> 1);
					else        c = c >>> 1;
				}
				tab[n] = c;  }
			return tab;  })(),
		update : function(c, buf, off, len) {
			for (var i=0; i<len; i++)  c = UPNG.crc.table[(c ^ buf[off+i]) & 0xff] ^ (c >>> 8);
			return c;
		},
		crc : function(b,o,l)  {  return UPNG.crc.update(0xffffffff,b,o,l) ^ 0xffffffff;  }
	}

	UPNG.quantize = function(abuf, ps)
	{	
		var oimg = new Uint8Array(abuf), nimg = oimg.slice(0), nimg32 = new Uint32Array(nimg.buffer);

		var KD = UPNG.quantize.getKDtree(nimg, ps);
		var root = KD[0], leafs = KD[1];
		
		var planeDst = UPNG.quantize.planeDst;
		var sb = oimg, tb = nimg32, len=sb.length;
			
		var inds = new Uint8Array(oimg.length>>2), nd;
		if(oimg.length<20e6)  // precise, but slow :(
			for(var i=0; i<len; i+=4) {
				var r=sb[i]*(1/255), g=sb[i+1]*(1/255), b=sb[i+2]*(1/255), a=sb[i+3]*(1/255);
				
				nd = UPNG.quantize.getNearest(root, r, g, b, a);
				inds[i>>2] = nd.ind;  tb[i>>2] = nd.est.rgba;
			}
		else 
			for(var i=0; i<len; i+=4) {
				var r=sb[i]*(1/255), g=sb[i+1]*(1/255), b=sb[i+2]*(1/255), a=sb[i+3]*(1/255);
				
				nd = root;  while(nd.left) nd = (planeDst(nd.est,r,g,b,a)<=0) ? nd.left : nd.right;
				inds[i>>2] = nd.ind;  tb[i>>2] = nd.est.rgba;
			}
		return {  abuf:nimg.buffer, inds:inds, plte:leafs  };
	}

	UPNG.quantize.getKDtree = function(nimg, ps, err) {
		if(err==null) err = 0.0001;
		var nimg32 = new Uint32Array(nimg.buffer);

		var root = {i0:0, i1:nimg.length, bst:null, est:null, tdst:0, left:null, right:null };  // basic statistic, extra statistic
		root.bst = UPNG.quantize.stats(  nimg,root.i0, root.i1  );  root.est = UPNG.quantize.estats( root.bst );
		var leafs = [root];

		while(leafs.length<ps)
		{
			var maxL = 0, mi=0;
			for(var i=0; i<leafs.length; i++) if(leafs[i].est.L > maxL) {  maxL=leafs[i].est.L;  mi=i;  }
			if(maxL<err) break;
			var node = leafs[mi];
			
			var s0 = UPNG.quantize.splitPixels(nimg,nimg32, node.i0, node.i1, node.est.e, node.est.eMq255);
			var s0wrong = (node.i0>=s0 || node.i1<=s0);
			//console.log(maxL, leafs.length, mi);
			if(s0wrong) {  node.est.L=0;  continue;  }


			var ln = {i0:node.i0, i1:s0, bst:null, est:null, tdst:0, left:null, right:null };  ln.bst = UPNG.quantize.stats( nimg, ln.i0, ln.i1 );  
			ln.est = UPNG.quantize.estats( ln.bst );
			var rn = {i0:s0, i1:node.i1, bst:null, est:null, tdst:0, left:null, right:null };  rn.bst = {R:[], m:[], N:node.bst.N-ln.bst.N};
			for(var i=0; i<16; i++) rn.bst.R[i] = node.bst.R[i]-ln.bst.R[i];
			for(var i=0; i< 4; i++) rn.bst.m[i] = node.bst.m[i]-ln.bst.m[i];
			rn.est = UPNG.quantize.estats( rn.bst );
			
			node.left = ln;  node.right = rn;
			leafs[mi]=ln;  leafs.push(rn);
		}
		leafs.sort(function(a,b) {  return b.bst.N-a.bst.N;  });
		for(var i=0; i<leafs.length; i++) leafs[i].ind=i;
		return [root, leafs];
	}

	UPNG.quantize.getNearest = function(nd, r,g,b,a)
	{
		if(nd.left==null) {  nd.tdst = UPNG.quantize.dist(nd.est.q,r,g,b,a);  return nd;  }
		var planeDst = UPNG.quantize.planeDst(nd.est,r,g,b,a);
		
		var node0 = nd.left, node1 = nd.right;
		if(planeDst>0) {  node0=nd.right;  node1=nd.left;  }

		var ln = UPNG.quantize.getNearest(node0, r,g,b,a);
		if(ln.tdst<=planeDst*planeDst) return ln;
		var rn = UPNG.quantize.getNearest(node1, r,g,b,a);
		return rn.tdst<ln.tdst ? rn : ln;
	}
	UPNG.quantize.planeDst = function(est, r,g,b,a) {  var e = est.e;  return e[0]*r + e[1]*g + e[2]*b + e[3]*a - est.eMq;  }
	UPNG.quantize.dist     = function(q,   r,g,b,a) {  var d0=r-q[0], d1=g-q[1], d2=b-q[2], d3=a-q[3];  return d0*d0+d1*d1+d2*d2+d3*d3;  }

	UPNG.quantize.splitPixels = function(nimg, nimg32, i0, i1, e, eMq)
	{
		var vecDot = UPNG.quantize.vecDot;
		i1-=4;
		var shfs = 0;
		while(i0<i1)
		{
			while(vecDot(nimg, i0, e)<=eMq) i0+=4;
			while(vecDot(nimg, i1, e)> eMq) i1-=4;
			if(i0>=i1) break;

			var t = nimg32[i0>>2];  nimg32[i0>>2] = nimg32[i1>>2];  nimg32[i1>>2]=t;

			i0+=4;  i1-=4;
		}
		while(vecDot(nimg, i0, e)>eMq) i0-=4;
		return i0+4;
	}
	UPNG.quantize.vecDot = function(nimg, i, e)
	{
		return nimg[i]*e[0] + nimg[i+1]*e[1] + nimg[i+2]*e[2] + nimg[i+3]*e[3];
	}
	UPNG.quantize.stats = function(nimg, i0, i1){
		var R = [0,0,0,0,  0,0,0,0,  0,0,0,0,  0,0,0,0];
		var m = [0,0,0,0];
		var N = (i1-i0)>>2;
		for(var i=i0; i<i1; i+=4)
		{
			var r = nimg[i]*(1/255), g = nimg[i+1]*(1/255), b = nimg[i+2]*(1/255), a = nimg[i+3]*(1/255);
			//var r = nimg[i], g = nimg[i+1], b = nimg[i+2], a = nimg[i+3];
			m[0]+=r;  m[1]+=g;  m[2]+=b;  m[3]+=a;

			R[ 0] += r*r;  R[ 1] += r*g;  R[ 2] += r*b;  R[ 3] += r*a;
						R[ 5] += g*g;  R[ 6] += g*b;  R[ 7] += g*a; 
										R[10] += b*b;  R[11] += b*a;  
														R[15] += a*a;  
		}
		R[4]=R[1];  R[8]=R[2];  R[9]=R[6];  R[12]=R[3];  R[13]=R[7];  R[14]=R[11];
		
		return {R:R, m:m, N:N};
	}
	UPNG.quantize.estats = function(stats){
		var R = stats.R, m = stats.m, N = stats.N;

		// when all samples are equal, but N is large (millions), the Rj can be non-zero ( 0.0003.... - precission error)
		var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], iN = (N==0 ? 0 : 1/N);
		var Rj = [
			R[ 0] - m0*m0*iN,  R[ 1] - m0*m1*iN,  R[ 2] - m0*m2*iN,  R[ 3] - m0*m3*iN,
			R[ 4] - m1*m0*iN,  R[ 5] - m1*m1*iN,  R[ 6] - m1*m2*iN,  R[ 7] - m1*m3*iN,
			R[ 8] - m2*m0*iN,  R[ 9] - m2*m1*iN,  R[10] - m2*m2*iN,  R[11] - m2*m3*iN,
			R[12] - m3*m0*iN,  R[13] - m3*m1*iN,  R[14] - m3*m2*iN,  R[15] - m3*m3*iN 
		];

		var A = Rj, M = UPNG.M4;
		var b = [Math.random(),Math.random(),Math.random(),Math.random()], mi = 0, tmi = 0;

		if(N!=0)
		for(var i=0; i<16; i++) {
			b = M.multVec(A, b);  tmi = Math.sqrt(M.dot(b,b));  b = M.sml(1/tmi,  b);
			if(i!=0 && Math.abs(tmi-mi)<1e-9) break;  mi = tmi;
		}	
		//b = [0,0,1,0];  mi=N;
		var q = [m0*iN, m1*iN, m2*iN, m3*iN];
		var eMq255 = M.dot(M.sml(255,q),b);

		return {  Cov:Rj, q:q, e:b, L:mi,  eMq255:eMq255, eMq : M.dot(b,q),
					rgba: (((Math.round(255*q[3])<<24) | (Math.round(255*q[2])<<16) |  (Math.round(255*q[1])<<8) | (Math.round(255*q[0])<<0))>>>0)  };
	}
	UPNG.M4 = {
		multVec : function(m,v) {
				return [
					m[ 0]*v[0] + m[ 1]*v[1] + m[ 2]*v[2] + m[ 3]*v[3],
					m[ 4]*v[0] + m[ 5]*v[1] + m[ 6]*v[2] + m[ 7]*v[3],
					m[ 8]*v[0] + m[ 9]*v[1] + m[10]*v[2] + m[11]*v[3],
					m[12]*v[0] + m[13]*v[1] + m[14]*v[2] + m[15]*v[3]
				];
		},
		dot : function(x,y) {  return  x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];  },
		sml : function(a,y) {  return [a*y[0],a*y[1],a*y[2],a*y[3]];  }
	}

	UPNG.encode.concatRGBA = function(bufs) {
		var tlen = 0;
		for(var i=0; i<bufs.length; i++) tlen += bufs[i].byteLength;
		var nimg = new Uint8Array(tlen), noff=0;
		for(var i=0; i<bufs.length; i++) {
			var img = new Uint8Array(bufs[i]), il = img.length;
			for(var j=0; j<il; j+=4) {
				var r=img[j], g=img[j+1], b=img[j+2], a = img[j+3];
				if(a==0) r=g=b=0;
				nimg[noff+j]=r;  nimg[noff+j+1]=g;  nimg[noff+j+2]=b;  nimg[noff+j+3]=a;  }
			noff += il;
		}
		return nimg.buffer;
	}

    function Bitmap(width, height) {
        this.width = width;
        this.height = height;
        this.pixel = new Array(width);
        for (var x = 0; x < width; x++) {
            this.pixel[x] = new Array(height);
            for (var y = 0; y < height; y++)
                this.pixel[x][y] = [0, 0, 0, 0];
        }
    }
    
    Bitmap.prototype.subsample = function(n) {
        var width = ~~(this.width / n);
        var height = ~~(this.height / n);
        var pixel = new Array(width);
        for (var x = 0; x < width; x++) {
            pixel[x] = new Array(height);
            for (var y = 0; y < height; y++) {
                var q = [0, 0, 0, 0];
                for (var i = 0; i < n; i++)
                    for (var j = 0; j < n; j++) {
                        var r = this.pixel[x*n+i][y*n+j];
                        q[0] += r[3] * r[0];
                        q[1] += r[3] * r[1];
                        q[2] += r[3] * r[2];
                        q[3] += r[3];
                    }
                if (q[3]) {
                    q[0] /= q[3];
                    q[1] /= q[3];
                    q[2] /= q[3];
                    q[3] /= n * n;
                }
                pixel[x][y] = q;
            }
        }
        this.width = width;
        this.height = height;
        this.pixel = pixel;
    }
    
    Bitmap.prototype.dataURL = function() {
        function sample(v) {
            return ~~(Math.max(0, Math.min(1, v)) * 255);
        }
    
        function gamma(v) {
            return sample(Math.pow(v, .45455));
        }
    
        function row(pixel, width, y) {
            var data = "\0";
            for (var x = 0; x < width; x++) {
                var r = pixel[x][y];
                data += String.fromCharCode(gamma(r[0]), gamma(r[1]),
                                            gamma(r[2]), sample(r[3]));
            }
            return data;
        }
    
        function rows(pixel, width, height) {
            var data = "";
            for (var y = 0; y < height; y++)
                data += row(pixel, width, y);
            return data;
        }
    
        function adler(data) {
            var s1 = 1, s2 = 0;
            for (var i = 0; i < data.length; i++) {
                s1 = (s1 + data.charCodeAt(i)) % 65521;
                s2 = (s2 + s1) % 65521;
            }
            return s2 << 16 | s1;
        }
    
        function hton(i) {
            return String.fromCharCode(i>>>24, i>>>16 & 255, i>>>8 & 255, i & 255);
        }
    
        function deflate(data) {
            var compressed = "\x78\x01";
            var i = 0;
            do {
                var block = data.slice(i, i + 65535);
                var len = block.length;
                compressed += String.fromCharCode(
                    ((i += block.length) == data.length) << 0,
                    len & 255, len>>>8, ~len & 255, (~len>>>8) & 255);
                compressed += block;
            } while (i < data.length);
            return compressed + hton(adler(data));
        }
    
        function crc32(data) {
            var c = ~0;
            for (var i = 0; i < data.length; i++)
                for (var b = data.charCodeAt(i) | 0x100; b != 1; b >>>= 1)
                    c = (c >>> 1) ^ ((c ^ b) & 1 ? 0xedb88320 : 0);
            return ~c;
        }
    
        function chunk(type, data) {
            return hton(data.length) + type + data + hton(crc32(type + data));
        }
    
        function base64(data) {
            var enc = "";
            for (var i = 5, n = data.length * 8 + 5; i < n; i += 6)
                enc +=
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[
                    (data.charCodeAt(~~(i/8)-1) << 8 | data.charCodeAt(~~(i/8))) >>
                    7 - i%8 & 63];
            for (; enc.length % 4; enc += "=");
            return enc;
        }
    
        var png = "\x89PNG\r\n\x1a\n" +
            chunk("IHDR", hton(this.width) + hton(this.height) + "\x08\x06\0\0\0") +
            chunk("IDAT", deflate(rows(this.pixel, this.width, this.height))) +
            chunk("IEND", "");
    
        return "data:image/png;base64," + base64(png);
    }

    function b64ToUint6 (nChr) {
        return nChr > 64 && nChr < 91 ?
            nChr - 65
          : nChr > 96 && nChr < 123 ?
            nChr - 71
          : nChr > 47 && nChr < 58 ?
            nChr + 4
          : nChr === 43 ?
            62
          : nChr === 47 ?
            63
          :
            0;
      }
      
    function base64DecToArr (sBase64, nBlockSize) {
    
    var
        sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
        nOutLen = nBlockSize ? Math.ceil((nInLen * 3 + 1 >>> 2) / nBlockSize) * nBlockSize : nInLen * 3 + 1 >>> 2, aBytes = new Uint8Array(nOutLen);
    
    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3;
        nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
        for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
            aBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
        }
        nUint24 = 0;
        }
    }
    
    return aBytes;
    }

    function transformArrayBufferToBase64 (buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        for (var len = bytes.byteLength, i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    const arrayBufferToBase64Img = (buffer) => {
    const str = String.fromCharCode(...new Uint8Array(buffer));
    return `data:image/png;base64,${window.btoa(str)}`;
    }

    // 设置矩形
    function setRectangle(gl, x, y, width, height) {
        var x1 = x;
        var x2 = x + width;
        var y1 = y;
        var y2 = y + height;

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2,
        ]), gl.STATIC_DRAW);
    }



	var my_blendColor = [100, 100, 100, 100];
	var my_SrcRGBA = [1, 1];        //默认为1，1
    var my_DstRGBA = [0, 0];        //默认为0，0
    var modeRGBA = [0, 0];      //默认是没有blend
    var sampleParameter = 100;  //多采样率

    function setFactor(gl, location, blendFactor) {
        var factor = [];
        if (blendFactor[0] == gl.ZERO) {
            factor[0] = [0,0,0];
        } else if (blendFactor[0] == gl.ONE) {
            factor = [100, 100, 100]
        } else if (blendFactor[0] == gl.CONSTANT_COLOR) {
            console.log('constant_color: ', my_blendColor);
            factor = my_blendColor
        } else if (blendFactor[0] == gl.SRC_ALPHA) {       //需要调整
            factor = [-1, -1, -1]
        } else if (blendFactor[0] == gl.ONE_MINUS_SRC_ALPHA){
            factor = [-2, -2, -2]
        }else {       //需要调整
            factor = [100, 100, 100]
        }

        if (blendFactor[1] == gl.ZERO) {
            factor.push(0);
        } else if (blendFactor[1] == gl.ONE) {
            factor.push(100);
        } else if (blendFactor[1] == gl.SRC_ALPHA) {       //需要调整
            factor.push(-1);
        } else if (blendFactor[0] == gl.ONE_MINUS_SRC_ALPHA){
            factor.push(-2);
        }else {       //需要调整
            factor.push(100);
        }

        console.log('setFactor', location, factor);
        gl.uniform4i(location, factor[0], factor[1], factor[2], factor[3]);
    }



    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
	Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        "value": function () {
            var dataurl = toDataURL.apply(this, arguments);
            console.log('todataURL is called: ', dataurl.hashCode());

            dataurl = dataurl.substring(22);
            var myArray = base64DecToArr(dataurl);
            var png = UPNG.decode(myArray);
        //    console.log(png);
            var rgba = UPNG.toRGBA8(png)[0];
            rgba = new Uint8Array(rgba);
            let bmp = new Bitmap(png.width, png.height);

            for(let x=0;x<png.width;x++){
                for(let y=0;y<png.height;y++){
                    let index = (x*png.width + y)*4;
                    bmp.pixel[x][y] = [rgba[index]/255, rgba[index+1]/255, rgba[index+2]/255, rgba[index+3]/255];
                }
            }

            dataurl = bmp.dataURL();
            return dataurl;
        }
    });

    const uniform1f = WebGLRenderingContext.prototype.uniform1f;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform1f", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[1] = Math.round(arguments[1] * 100)/100;

            return uniform1f.apply(this, arguments);
        }
    });

    const uniform2f = WebGLRenderingContext.prototype.uniform2f;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform2f", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            console.log('uniform2f is called: ', arguments);
            arguments[1] = Math.round(arguments[1] * 100)/100;
            arguments[2] = Math.round(arguments[2] * 100)/100;

            return uniform2f.apply(this, arguments);
        }
    });

    const uniform3f = WebGLRenderingContext.prototype.uniform1f;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform1f", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[1] = Math.round(arguments[1] * 100)/100;
            arguments[2] = Math.round(arguments[2] * 100)/100;
            arguments[3] = Math.round(arguments[3] * 100)/100;

            return uniform3f.apply(this, arguments);
        }
    });

    const uniform4f = WebGLRenderingContext.prototype.uniform1f;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform1f", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[1] = Math.round(arguments[1] * 100)/100;
            arguments[2] = Math.round(arguments[2] * 100)/100;
            arguments[3] = Math.round(arguments[3] * 100)/100;
            arguments[4] = Math.round(arguments[4] * 100)/100;

            return uniform4f.apply(this, arguments);
        }
    });

    const uniform1fv = WebGLRenderingContext.prototype.uniform1fv;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform1fv", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            for(let i=0;i<arguments[1].length;i++)
                arguments[1][i] = Math.round(arguments[1][i] * 100)/100;

            return uniform1fv.apply(this, arguments);
        }
    });

    const uniform2fv = WebGLRenderingContext.prototype.uniform2fv;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform2fv", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            for(let i=0;i<arguments[1].length;i++)
                arguments[1][i] = Math.round(arguments[1][i] * 100)/100;

            return uniform2fv.apply(this, arguments);
        }
    });

    const uniform3fv = WebGLRenderingContext.prototype.uniform3fv;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform3fv", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            for(let i=0;i<arguments[1].length;i++)
              arguments[1][i] = Math.round(arguments[1][i] * 100)/100;

            return uniform3fv.apply(this, arguments);
        }
    });

    const uniform4fv = WebGLRenderingContext.prototype.uniform4fv;
	Object.defineProperty(WebGLRenderingContext.prototype, "uniform4fv", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            for(let i=0;i<arguments[1].length;i++)
                arguments[1][i] = Math.round(arguments[1][i] * 100)/100;

            return uniform4fv.apply(this, arguments);
        }
    });

    const lineWidth = WebGLRenderingContext.prototype.lineWidth;
	Object.defineProperty(WebGLRenderingContext.prototype, "lineWidth", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[0] = 1.0;

            return lineWidth.apply(this, arguments);
        }
    });

    const clearDepth = WebGLRenderingContext.prototype.clearDepth;
	Object.defineProperty(WebGLRenderingContext.prototype, "clearDepth", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[0] = Math.round(arguments[0]*100)/100;

            return clearDepth.apply(this, arguments);
        }
    });

    const polygonOffset = WebGLRenderingContext.prototype.polygonOffset;
	Object.defineProperty(WebGLRenderingContext.prototype, "polygonOffset", {
        "value": function () {
        //    gl.uniform1f(v_f, x[i]);
            arguments[0] = Math.round(arguments[0]*100)/100;
            arguments[1] = Math.round(arguments[1]*100)/100;

            return polygonOffset.apply(this, arguments);
        }
    });

    const sampleCoverage = WebGLRenderingContext.prototype.sampleCoverage;
	Object.defineProperty(WebGLRenderingContext.prototype, "sampleCoverage", {
        "value": function () {
            console.log('sampleCoverage is called');
            sampleParameter = Math.round(arguments[0] * 100.0);
            if(sampleParameter > 100)
                sampleParameter = 100;
        }
    });

    const clearColor = WebGLRenderingContext.prototype.clearColor;
	Object.defineProperty(WebGLRenderingContext.prototype, "clearColor", {
        "value": function () {

            let clearColorRed = Math.round(arguments[0] * 255.0) / 255.0;
            let clearColorGreen = Math.round(arguments[1] * 255.0) / 255.0;
            let clearColorBlue = Math.round(arguments[2] * 255.0) / 255.0;
            let clearColorAlpha = Math.round(arguments[3] * 255.0) / 255.0;

            return clearColor.apply(this, [clearColorRed, clearColorGreen, clearColorBlue, clearColorAlpha]);
        }
    });

    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const pixelStorei = WebGLRenderingContext.prototype.pixelStorei;
	Object.defineProperty(WebGLRenderingContext.prototype, "pixelStorei", {
        "value": function () {
            console.log('pixelStorei is called.');
            if(arguments[0] == this.UNPACK_FLIP_Y_WEBGL)
                arguments[1] = false;
            pixelStorei.apply(this, arguments)
        }
    });

    const drawElements = WebGLRenderingContext.prototype.drawElements;
	Object.defineProperty(WebGLRenderingContext.prototype, "drawElements", {
        "value": function () {
            //	console.log('drawElements is called: ', arguments);
            var destination = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, destination);

            this.clearColor(0,0,0,0);
            this.clear(this.COLOR_BUFFER_BIT, true);
            drawElements.apply(this, arguments);

            var source = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, source);
            newTask(this, [source, destination]);
        }
    });

    const drawArrays = WebGLRenderingContext.prototype.drawArrays;
	Object.defineProperty(WebGLRenderingContext.prototype, "drawArrays", {
        "value": function () {
            var len = arguments.length;
                if(arguments.length == 4){
                    drawArrays.apply(this, [arguments[0], arguments[1], arguments[2]]);
                    return;
                }else{

                    var destination = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                    this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, destination);

                //    this.clearColor(0,0,0,0);
                //    this.clear(this.COLOR_BUFFER_BIT, true);
                    drawArrays.apply(this, arguments);

                    var source = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                    this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, source);

                    newTask(this, [source, destination]);
                }
        }
    });



    const blendEquation = WebGLRenderingContext.prototype.blendEquation;
	Object.defineProperty(WebGLRenderingContext.prototype, "blendEquation", {
        "value": function () {
            console.log('blendEquation is called', arguments[0], this.FUNC_SUBTRACT);
            //gl.FUNC_ADD
            if(arguments[0] == this.FUNC_ADD)
                modeRGBA = [0, 0];
            if(arguments[0] == this.FUNC_SUBTRACT)
                modeRGBA = [1, 1]
            if(arguments[0] == this.FUNC_REVERSE_SUBTRACT)
                modeRGBA = [2, 2]
        }
    });

    const blendColor = WebGLRenderingContext.prototype.blendColor;
	Object.defineProperty(WebGLRenderingContext.prototype, "blendColor", {
        "value": function () {
            my_blendColor[0] = Math.round(arguments[0]*100);
            my_blendColor[1] = Math.round(arguments[1]*100);
            my_blendColor[2] = Math.round(arguments[2]*100);
            my_blendColor[3] = Math.round(arguments[3]*100);
            console.log('blendColor is called: ', my_blendColor);
        }
    });

    const blendFunc = WebGLRenderingContext.prototype.blendFunc;
	Object.defineProperty(WebGLRenderingContext.prototype, "blendFunc", {
        "value": function () {
            my_SrcRGBA[0] = arguments[0];
            my_SrcRGBA[1] = arguments[0];

            my_DstRGBA[0] = arguments[1];
            my_DstRGBA[1] = arguments[1];
        }
    });

    //void gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
    const blendFuncSeparate = WebGLRenderingContext.prototype.blendFuncSeparate;
	Object.defineProperty(WebGLRenderingContext.prototype, "blendFuncSeparate", {
        "value": function () {
            my_SrcRGBA[0] = arguments[0];
            my_SrcRGBA[1] = arguments[2];


            my_DstRGBA[0] = arguments[1];
            my_DstRGBA[1] = arguments[3];
        }
    });


    const clear = WebGLRenderingContext.prototype.clear;
	Object.defineProperty(WebGLRenderingContext.prototype, "clear", {
        "value": function () {
        //    console.log('clear is called');
            if(arguments.length == 2){
                clear.apply(this, [arguments[0]]);
                return;
            }
            clear.apply(this, arguments);
        /*
            var destination = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, destination);

            clear.apply(this, arguments);

            var source = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, source);
            newTask(this, [destination, source]);
        */
        }
    });


    var newTask = function(gl, images) {

        console.log('newTask is called: ');

        let fsSource = `

		precision mediump float;
		// 纹理
		uniform sampler2D u_image0;     //source
		uniform sampler2D u_image1;     //destination

		// 从顶点着色器传入的 texCoords
		varying vec2 v_texCoord;
		uniform ivec4 sFactor;
		uniform ivec4 dFactor;
        uniform ivec2 modeRGBA;
        uniform int sampleParameter;

		uniform int gcd[256];
		
		bool check(int C, int A){
			float res = float(C)*255.0/float(A);
			res = fract(res);
			
			if(res<0.4 || res>0.6)
				return true;
			return false;
		}
		
		
		int myAbs(int a){
			if(a>0)
				return a;
			return -1*a;
		}
		
		int getDis(int A, int B){
			if(A>B)
				return A-B;
			return B-A;
		}
		
		int getMin(int A, int B){
			if(A<B)
				return A;
			return B;
		}
		
		vec4 opt(int R, int G, int B, int A){
			if(A==0)
				return vec4(0.0, 0.0, 0.0, 0.0);
			if(A == 255)
				return vec4(float(R)/255.0, float(G)/255.0, float(B)/255.0, float(A)/255.0);
		
			//判断RGB是否大于A
			bool flag_R = R<A;
			bool flag_G = G<A;
			bool flag_B = B<A;

			R = R<A? R: A;
			G = G<A? G: A;
			B = B<A? B: A;

			int tmp, n, d1=0, d2=0, d3=0, min=255*4;
		
			int best_r=255, best_g=255, best_b=255, best_a=255, best_tmp=255;
			int current_r, current_g, current_b, current_a;
			int myDis;

			//找到合适的a值
			for(int a=1;a<=255;a++){
				if(getDis(A, a) > 7)
					continue;
				
				tmp = gcd[a];
				if(flag_R){
					n = R/tmp;
					myDis = getMin(getDis(n*tmp, R), getDis((n+1)*tmp, R) );
					d1 = myDis * myDis;
				}
				if(d1>min)
					continue;
				
				if(flag_G){
					n = G/tmp;
					myDis = getMin(getDis(n*tmp, G), getDis((n+1)*tmp, G) );
					d2 = myDis * myDis;
				}
				if(d1+d2>min)
					continue;
			
				if(flag_B){
					n = B/tmp;
					myDis = getMin(getDis(n*tmp, B), getDis((n+1)*tmp, B) );
					d3 = myDis * myDis;
				}
				if(d1+d2+d3>min)
					continue;
				if(d1+d2+d3<min){
					min = d1+d2+d3;
					best_a = a;
					best_tmp = tmp;
				}else if(d1+d2+d3 == min){
					if(getDis(A, a) < getDis(A, best_a)){
						best_a = a;
						best_tmp = tmp;
					}
				}

			}

		
			//修改R
			if(flag_R){
				n = R/best_tmp;
				if(getDis(n*best_tmp, R) < getDis((n+1)*best_tmp, R)){
					best_r = n*best_tmp;
				}else{
					best_r = (n+1)*best_tmp;
				}
			}else{
				best_r = best_a;
			}
		
			//修改G
			if(flag_G){
				n = G/best_tmp;
				if(getDis(n*best_tmp, G) < getDis((n+1)*best_tmp, G)){
					best_g = n*best_tmp;
				}else{
					best_g = (n+1)*best_tmp;
				}
			}else{
				best_g = best_a;
			}
		
			//修改B
			if(flag_B){
				n = B/best_tmp;
				if(getDis(n*best_tmp, B) < getDis((n+1)*best_tmp, B)){
					best_b = n*best_tmp;
				}else{
					best_b = (n+1)*best_tmp;
				}
			}else{
				best_b = best_a;
			}

			if(best_r > best_a)
				best_r = best_a;
			if(best_g > best_a)
				best_g = best_a;
			if(best_b > best_a)
				best_b = best_a;

			return vec4(float(best_r)/255.0, float(best_g)/255.0, float(best_b)/255.0, float(best_a)/255.0);
		}
		
		//弱策略
		vec4 hillclimb(int R, int G, int B, int A){
			if(check(R,A) && check(G,A) && check(B, A)){
				return vec4(float(R)/255.0, float(G)/255.0, float(B)/255.0, float(A)/255.0);
			}

			int current_r, current_g, current_b, current_a;
			int r, g, b, a, min = 255*3;
			int d1, d2, d3, flag, changed;
			int best_r, best_g, best_b, best_a;
		
			changed = 0;
			for(int m=0;m<20;m++){
				if(changed==1)
					break;
		
				best_r = R + 3*m;
				best_g = G + 3*m;
				best_b = B + 3*m;
				best_a = A - 3*m;
				flag = 1;
		
				for(int n=0;n<20;n++){
					//更新当前值，重新找最优解
					if(flag == 1){
						flag = 0;
						current_r = best_r ;
						current_g = best_g ;
						current_b = best_b ;
						current_a = best_a ;
					}else{
						break;
					}
		
		
					for(int i=-1;i<2;i++){
						a = current_a + i;
						for(int j=-1;j<2;j++){
							r = current_r + j;
							if(!check(r, a))
								continue;
							d1 = myAbs(R-A+a-r);
							if(d1>min)
								continue;
							for(int k=-1;k<2;k++){
								g = current_g + k;
								if(!check(g,a))
									continue;
								d2 = myAbs(G-A+a-g);
								if(d1+d2>=min)
									continue;
								for(int l=-1;l<2;l++){
									b = current_b + l;
									if(!check(b,a))
										continue;
									d3 = myAbs(B-A+a-b);
									if(d1+d2+d3>=min)
										continue;
									min = d1+d2+d3;
									best_r = r;
									best_g = g;
									best_b = b;
									best_a = a;
		
									//找到了更优解
									flag = 1;
									changed = 1;
								}
							}
						}
					}
		
				}
			}
		//	return 	vec4(float(min)/255.0, float(min)/255.0, float(min)/255.0, float(255.0)/255.0);
			return 	vec4(float(best_r)/255.0, float(best_g)/255.0, float(best_b)/255.0, float(best_a)/255.0);
		}



        ivec4 dst_Blend(ivec4 factor, ivec4 src, ivec4 dst){
            ivec4 RES;
            if(factor[0] == -1){    //gl.SRC_ALPHA 所有颜色乘上源颜色
                RES.x = dst.x * src.w / 255;
                RES.y = dst.y * src.w / 255;
                RES.z = dst.z * src.w / 255;
            }else if(factor[0] == -2){  //gl.ONE_MINUS_SRC_ALPHA 所有颜色乘上源颜色
                RES.x = dst.x * (255 - src.w) / 255;
                RES.y = dst.y * (255 - src.w) / 255;
                RES.z = dst.z * (255 - src.w) / 255;

            //    RES.x = dst.x;// * (255 - src.w) / 255;
            //    RES.y = dst.y;// * (255 - src.w) / 255;
            //    RES.z = dst.z;// * (255 - src.w) / 255;

            }else{  //正数
                RES.x = dst.x * factor.x / 100;
                RES.y = dst.y * factor.y / 100;
                RES.z = dst.z * factor.z / 100;
            }

            if(factor[3] == -1){    //gl.SRC_ALPHA 所有颜色乘上源颜色
                RES.w = dst.w * src.w / 255;
            }else if(factor[0] == -2){  //gl.ONE_MINUS_SRC_ALPHA 所有颜色乘上源颜色
                RES.w = dst.w * (255 - src.w) / 255;
            }else{  //正数
                RES.w = dst.w * factor.w / 100;
            }
            return RES;
        }

        ivec4 src_Blend(ivec4 factor, ivec4 src, ivec4 dst){
            if(src.x == 0 && src.y == 0 && src.z ==0 && src.w == 0)
                return ivec4(0, 0, 0, 0);

            ivec4 RES;
            if(factor[0] == -1){    //gl.SRC_ALPHA 所有颜色乘上源颜色
                RES.x = src.x * src.w / 255;
                RES.y = src.y * src.w / 255;
                RES.z = src.z * src.w / 255;
            }else if(factor[0] == -2){  //gl.ONE_MINUS_SRC_ALPHA 所有颜色乘上源颜色
                RES.x = src.x * (255 - src.w) / 255;
                RES.y = src.y * (255 - src.w) / 255;
                RES.z = src.z * (255 - src.w) / 255;
            }else{  //正数
                RES.x = src.x * factor.x / 100;
                RES.y = src.y * factor.y / 100;
                RES.z = src.z * factor.z / 100;
            }

            if(factor[3] == -1){    //gl.SRC_ALPHA 所有颜色乘上源颜色
                RES.w = src.w * src.w / 255;
            }else if(factor[3] == -2){  //gl.ONE_MINUS_SRC_ALPHA 所有颜色乘上源颜色
                RES.w = src.w * (255 - src.w) / 255;
            }else{  //正数
                RES.w = src.w * factor.w / 100;
            }

            RES.x = RES.x * sampleParameter / 100;
            RES.y = RES.y * sampleParameter / 100;
            RES.z = RES.z * sampleParameter / 100;
            return RES;
        }

        ivec4 post_Blend(ivec2 mode, ivec4 src, ivec4 dst){
            ivec4 RES;
            if(mode[0] == 0){
                RES.xyz = ivec3(src.x + dst.x, src.y + dst.y, src.z + dst.z);
            }else if(mode[0] == 1){
                RES.xyz = ivec3(src.x - dst.x, src.y - dst.y, src.z - dst.z);
            }else{
                RES.xyz = ivec3(dst.x - src.x, dst.y - src.y, dst.z - src.z);
            }

            if(mode[1] == 0){
                RES.w = src.w + dst.w;
            }else if(mode[1] == 1){
                RES.w = src.w - dst.w;
            }else{
                RES.w = dst.w - src.w;
            }
        //    return ivec4(mode.x, mode.y, 255, 255);

            return RES;
        }

		void main() {
			vec4 color0 = texture2D(u_image0, v_texCoord);  //源
			vec4 color1 = texture2D(u_image1, v_texCoord);  //目的


			int R1 = int(floor(color0.x*255.0+0.1));  //源
			int R2 = int(floor(color1.x*255.0+0.1));  //目的

			int G1 = int(floor(color0.y*255.0+0.1));
			int G2 = int(floor(color1.y*255.0+0.1));

			int B1 = int(floor(color0.z*255.0+0.1));
			int B2 = int(floor(color1.z*255.0+0.1));
		
			int A1 = int(floor(color0.w*255.0+0.1));
			int A2 = int(floor(color1.w*255.0+0.1));

            ivec4 src = src_Blend(sFactor, ivec4(R1, G1, B1, A1), ivec4(R2, G2, B2, A2));
            ivec4 dst = dst_Blend(dFactor, ivec4(R1, G1, B1, A1), ivec4(R2, G2, B2, A2));
        //  ivec4 dst = dst_Blend(dFactor, src, ivec4(R2, G2, B2, A2));

            ivec4 RGBA = post_Blend(modeRGBA, src, dst);

        //    RGBA = ivec4(R1, B1, G1, A1);   //work
        //    RGBA = src;     //work

        //    RGBA = dst;     //work
        //    RGBA = ivec4(R2, G2, B2, A2);
        //    RGBA = post_Blend(modeRGBA, src, dst);    //bug
        //    RGBA = src + dst;     //bug

		//	gl_FragColor = vec4(float(RGBA.x)/255.0, float(RGBA.y)/255.0, float(RGBA.z)/255.0, float(RGBA.w)/255.0);
			gl_FragColor = opt(RGBA.x, RGBA.y, RGBA.z, RGBA.w);
		//  gl_FragColor = hillclimb(R, G, B, A);
		}

		`
        let vsSource = `
    //	顶点着色器程序
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    void main() {
    // 从像素坐标转换到 0.0 到 1.0
    vec2 zeroToOne = a_position / u_resolution;

    // 再把 0->1 转换 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // 把 0->2 转换到 -1->+1 (裁剪空间)
    vec2 clipSpace = zeroToTwo - 1.0;

    //若纹理来自image标签，则y坐标要上下颠倒
    //gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    //若纹理来自readpixels读取的ArrayBuffer，则y坐标不需要上下颠倒
    gl_Position = vec4(clipSpace * vec2(1, 1), 0, 1);

    // 将纹理坐标传给片断着色器
    // GPU会在点之间进行插值
    v_texCoord = a_texCoord;
    }
    `

        //
        // 创建着色器
        //
        var vShader = gl.createShader(gl.VERTEX_SHADER);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);



        gl.shaderSource(vShader, vsSource);
        gl.shaderSource(fShader, fsSource);
        gl.compileShader(vShader);
        if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            console.error('ERROR compiling fragment shader!',
                          gl.getShaderInfoLog(vShader));
            return;
          }
        gl.compileShader(fShader);
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            console.error('ERROR compiling fragment shader!',
                          gl.getShaderInfoLog(fShader));
            return;
          }
        var program = gl.createProgram();
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);
        gl.validateProgram(program);
        if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
            console.error('ERROR validating program!',
                gl.getProgramInfoLog(program));
            return;
        }

        // 使用着色器程序
        gl.useProgram(program);

        // 指定从哪获取顶点数据
        var positionLocation = gl.getAttribLocation(program, "a_position");
        var texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

        // 创建缓冲区存放剪辑空间坐标
        var positionBuffer = gl.createBuffer();

        // 绑定顶点与缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // 设置和图片大小相同的矩形
        setRectangle(gl, 0, 0, 256, 256);

        // 为矩形提供纹理坐标
        var texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ]), gl.STATIC_DRAW);

        let textures = [];
        for (let ii = 0; ii < 2; ++ii) {
            let texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // 设置参数以便使用任意尺的影像
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            // 上传图像到纹理
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, images[ii]);
            // 将纹理添加到纹理序列
            textures.push(texture);
        }

        // 寻找取样器的位置
        var u_image0Location = gl.getUniformLocation(program, "u_image0");
        var u_image1Location = gl.getUniformLocation(program, "u_image1");
        // 设置使用的纹理单元
        gl.uniform1i(u_image0Location, 0); // 纹理单元 0
        gl.uniform1i(u_image1Location, 1); // 纹理单元 1
        // 设置每个纹理单元对应一个纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[0]);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures[1]);

        // 指定从哪获取uniform
        var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        var sFactor = gl.getUniformLocation(program, 'sFactor');
        var dFactor = gl.getUniformLocation(program, 'dFactor');
        var mode_RGBA = gl.getUniformLocation(program, 'modeRGBA');
        //console.log(modeRGBA);
        gl.uniform2i(mode_RGBA, modeRGBA[0], modeRGBA[1]);

        var sample_location = gl.getUniformLocation(program, 'sampleParameter');
        //console.log(modeRGBA);
        gl.uniform1i(sample_location, sampleParameter);


        // 告诉WebGL如何从剪辑空间转换为像素
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 开启position属性
        gl.enableVertexAttribArray(positionLocation);

        // 将position属性与缓存区绑定
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // 告诉position属性如何从positionBuffer中获取数据
        var size = 2; // 每次迭代提取两个数据
        var type = gl.FLOAT; // 数据是 32bit 浮点型数据
        var normalize = false; // 不规范化数据
        var stride = 0; // 每次读取数据跳过0个数据
        var offset = 0; // 从缓存区的第0个数据开始读取
        gl.vertexAttribPointer(
            positionLocation, size, type, normalize, stride, offset);

        // 开启texcord 属性
        gl.enableVertexAttribArray(texcoordLocation);

        // 将texcord属性与缓冲区绑定
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

        // 告诉position属性如何从positionBuffer中获取数据
        var size = 2; // 每次迭代提取两个数据
        var type = gl.FLOAT; // 数据是 32bit 浮点型数据
        var normalize = false; // 不规范化数据
        var stride = 0; // 每次读取数据跳过0个数据
        var offset = 0; // 从缓存区的第0个数据开始读取
        gl.vertexAttribPointer(
            texcoordLocation, size, type, normalize, stride, offset);

        // 设置分辨率
        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

	//	console.log('blendColor: ', my_blendColor);
	//	console.log('blendFactor: ', my_blendFactor);
        //设置source
        setFactor(gl, sFactor, my_SrcRGBA);
        setFactor(gl, dFactor, my_DstRGBA);

		var gcd = gl.getUniformLocation(program, "gcd");
		//y[n]表示A=n, n/gcd(n,255)
		var y = [0,1,2,1,4,1,2,7,8,3,2,11,4,13,14,1,16,1,6,19,4,7,22,23,8,5,26,9,28,29,2,31,32,11,2,7,12,37,38,13,8,41,14,43,44,3,46,47,16,49,10,1,52,53,18,11,56,19,58,59,4,61,62,21,64,13,22,67,4,23,14,71,24,73,74,5,76,77,26,79,16,27,82,83,28,1,86,29,88,89,6,91,92,31,94,19,32,97,98,33,20,101,2,103,104,7,106,107,36,109,22,37,112,113,38,23,116,39,118,7,8,121,122,41,124,25,42,127,128,43,26,131,44,133,134,9,8,137,46,139,28,47,142,143,48,29,146,49,148,149,10,151,152,3,154,31,52,157,158,53,32,161,54,163,164,11,166,167,56,169,2,57,172,173,58,35,176,59,178,179,12,181,182,61,184,37,62,11,188,63,38,191,64,193,194,13,196,197,66,199,40,67,202,203,4,41,206,69,208,209,14,211,212,71,214,43,72,217,218,73,44,13,74,223,224,15,226,227,76,229,46,77,232,233,78,47,236,79,14,239,16,241,242,81,244,49,82,247,248,83,50,251,84,253,254,1];
		gl.uniform1iv(gcd, y);

        // 绘制矩形
        // gl.drawArrays是个异步操作，绘画结束之前取值会出现问题。

		var stallGPU = new Uint8Array(1 * 1 * 4);
		const startime = window.performance.now();

        gl.drawArrays(gl.TRIANGLES, 0, 6, true);

		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, stallGPU);
		console.log('pixel: ', stallGPU);
		const stoptime = window.performance.now();
		console.log('执行时间: ', stoptime-startime);
    }

};

var script_1 = document.createElement("script");
script_1.textContent = "(" + inject + ")()";
document.documentElement.appendChild(script_1);
script_1.remove();