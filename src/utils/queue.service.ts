// src/utils/crypto.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue,Job,Worker } from  "bullmq"

@Injectable()
export class QueueService {
  private readonly connection
  private readonly defaultSettings
  constructor(private configService: ConfigService) {
    this.connection ={connection:this.configService.getOrThrow('redis.redisUrl')}
    this.defaultSettings={
      removeOnCompleted: true,
      removeOnFail:true,
    }
  }

  async createQueue(channel) {
    return new Queue(channel, this.connection);
  }
  async add(queue, jobName, data, options = {}) {
    return queue.add(jobName, data, { ...this.defaultSettings, ...options });
  }

  async createWorker(channel,handler) {
    return new Worker(
      channel,
      async (job) => handler(job),
      this.connection
    );
  }

  async removeJob(queue,jobName){
    let deleteJob = await queue.getJob(jobName);
    return deleteJob.remove()
  }




}
