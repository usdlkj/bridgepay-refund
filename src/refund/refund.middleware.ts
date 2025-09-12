import { Injectable, NestMiddleware,Inject } from '@nestjs/common';
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { ConfigService } from '@nestjs/config';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';

@Injectable()
export class PublicApiMiddleware implements NestMiddleware {
  private env: string;
  constructor(
    private readonly configService: ConfigService,
    
    ) {this.env = getEnv(this.configService);}
  async use(req: { 
    originalUrl: string,
    body: { 
      reqData: object,
      signMsg: string
    }}, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: any, next: () => void) {
    const payload = JSON.stringify(req.body.reqData);
  const filename = await this.configService.get('refund.keyFilePublic') || "pgmid.pub";
  const pkey = fs.readFileSync(path.join(__dirname, "../../key/"+filename), {
    encoding: "utf8",
    flag: "r",
  });

  const verifyFormat={
    key: pkey
  }
  const publicKeyPass = await this.configService.get('refund.keyFilePublicPass')
  if(publicKeyPass!=""){
    verifyFormat["passphrase"] = publicKeyPass
  }

  const check = crypto.verify(
    "sha256",
    Buffer.from(payload),
    verifyFormat,
    Buffer.from(req.body.signMsg, "base64")
  );
  const payloadSave={
    endpoint:req.originalUrl,
    payload:JSON.stringify(req.body.reqData),
    rawPayload:JSON.stringify(req.body),
    signature:req.body.signMsg,
    createdAt:new Date(),
     updatedAt: new Date(),

  }
  if (check == true) {
    payloadSave["signatureStatus"]="accepted";
    // await this.coreService.send({cmd:"save-api-log-debug"},payloadSave).toPromise();
    next();
  } else {
    payloadSave["signatureStatus"]="rejected";
    // await this.coreService.send({cmd:"save-api-log-debug"},payloadSave).toPromise();
    res.status(500).json({ retCode: -1, retMsg: "Invalid Signature" });
  }
  }
}
