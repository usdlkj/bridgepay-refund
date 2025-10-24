import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Helper } from '../../utils/helper';

@Injectable()
export class IlumaService {
  constructor(private helper: Helper) {}

  async bankList(payload) {
    try {
      const key = await this.#generateKey(payload.credential);
      const bankList = await axios({
        url: 'https://api.iluma.ai/bank/available_bank_codes',
        method: 'get',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
      });
      return {
        status: 200,
        data: bankList.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async bankValidator(payload) {
    try {
      const key = await this.#generateKey(payload.credential);
      const bankValidation = await axios({
        url: 'https://api.iluma.ai/v1.2/identity/bank_account_validation_details',
        method: 'post',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
        data: payload.data,
      });
      return {
        status: 200,
        data: bankValidation.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async getWebhook(payload) {
    try {
      const key = this.#generateKey(payload.credential);
      const webhook = await axios({
        url: 'https://api.iluma.ai/v1/callback/urls',
        method: 'get',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
      });
      return {
        status: 200,
        data: webhook.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async setWebhook(payload) {
    try {
      const key = this.#generateKey(payload.credential);
      const webhook = await axios({
        url: 'https://api.iluma.ai/v1/callback/urls',
        method: 'post',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
        data: payload.data,
      });
      return {
        status: 200,
        data: webhook.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async updateWebhook(payload) {
    try {
      const key = this.#generateKey(payload.credential);
      const webhook = await axios({
        url: 'https://api.iluma.ai/v1/callback/urls',
        method: 'patch',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
        data: {
          url: payload.data.url,
        },
      });
      return {
        status: 200,
        data: webhook.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async getResult(payload) {
    try {
      const key = this.#generateKey(payload.credential);
      const webhook = await axios({
        url:
          'https://api.iluma.ai/v1.2/identity/bank_account_validation_details/' +
          payload.requestId,
        method: 'get',
        headers: {
          Authorization: 'Basic ' + key,
          'Content-Type': 'application/json',
        },
      });
      return {
        status: 200,
        data: webhook.data,
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }

  async #generateKey(token) {
    const auth = token + ':';
    const key = Buffer.from(auth).toString('base64');
    return key;
  }
}
