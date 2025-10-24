import { Injectable } from '@nestjs/common';
import axios from 'axios';
const url = 'https://api.xendit.co';

@Injectable()
export class XenditService {
  constructor() {}

  async disbursement(payload) {
    try {
      const auth = payload.token + ':';
      let result;
      const key = Buffer.from(auth).toString('base64');
      const disbursement = await axios({
        url: ' https://api.xendit.co/disbursements',
        method: 'post',
        data: payload.data,
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
          'X-IDEMPOTENCY-KEY': payload.idempotencyKey,
        },
      });
      if (disbursement.status == 200) {
        result = {
          status: 200,
          data: disbursement.data,
        };
      } else {
        result = {
          status: disbursement.status,
          data: JSON.stringify(disbursement),
        };
      }
      return result;
    } catch (e) {
      return { status: 500, msg: e.message, xenditCode: e.status };
    }
  }

  async getBalance(payload) {
    try {
      const balance = await axios.get('https://api.xendit.co/balance', {
        auth: {
          username: payload.token,
          password: '',
        },
      });
      return {
        status: 200,
        data: balance.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }
}
