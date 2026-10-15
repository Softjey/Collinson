import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

export const IsLanguageCode = (): PropertyDecorator => applyDecorators(IsString(), Matches(/^[A-Za-z]{2}$/));
