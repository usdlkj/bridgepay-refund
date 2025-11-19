import { Injectable,OnApplicationBootstrap } from '@nestjs/common';
import { QueueService } from 'src/utils/queue.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankData } from 'src/iluma/entities/bank-data.entity';


@Injectable()
export class CheckAccountService implements OnApplicationBootstrap {
    constructor(
        @InjectRepository(BankData)
        private repositoryBankData: Repository<BankData>,
        private queueService: QueueService,
    ){

    }
    async onApplicationBootstrap(){
        this.queueService.createWorker("refundCheckAccount",async(job)=>{
            await this.repositoryBankData.delete({
                accountNumber:job.data.data,
                accountStatus:'pending'
            })
        })
        // const token = process.env.TELEGRAM_BOT_TOKEN;
        // const bot = new TelegramBot(token, {polling: true});
        
        // bot.onText(/\/order (.+)/, async (msg, match) => {
        //     try {
        //         console.log(match);
        //         // 'msg' is the received Message from Telegram
        //         // 'match' is the result of executing the regexp above on the text content
        //         // of the message

        //         const chatId = msg.chat.id;
        //         const data = match[1]; // the captured "whatever"
        //         const order = null
                
        //         if (order === null) { throw new Error(data+": Data tidak diketemukan") }
                
        //         var invoiceData = JSON.parse(order.invoiceData);
        //         var resp = "Order ID: " + order.invoiceNumber + "\n";
        //         resp += "Order Number: " + order.invoiceNumber.substring(2,12) + "\n"; 	
        //         resp += "Name: " + invoiceData.reqData.billing.name + "\n";
        //         resp += "Nominal: " + parseFloat(order.amount).toLocaleString(undefined) + "\n";
        //         resp += "Order Date: " + order.orderDate + "\n";
        //         resp += "Payment Type: " + order.paymentType + "\n";
        //         resp += "Middleware: " + order.status + "\n";
        //         resp += "VA: " + order.vaNumber + "\n";

        //         // send back the matched "whatever" to the chat
        //         bot.sendMessage(chatId, resp);
        //     } catch (e) {
        //         bot.sendMessage(msg.chat.id, e.message);
        //     }
        // });
    }
}
