export class CreatePaymentGatewayDto {
  pgName: string;
  pgCode: string;
  credential: string;
  status: string;
  weight: number;
  percentageRange: string;
}
