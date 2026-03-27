import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'INR', 'MXN', 'BRL', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK',
  'DKK', 'PLN', 'ZAR'
];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES, { message: 'Invalid currency code' })
  displayCurrency?: string;
}
