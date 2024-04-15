import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Request,
  Response,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Response as Res } from 'express';
import * as https from 'https';
import { decrypt, encrypt, md5 } from './encrypt';

@Controller('movie')
export class MovieController {
  private key = 'lbwyBzfgzUIvXZFShJuikaWvLJhIVq36';
  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get(':url')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  async getMovieM3u8(@Param() param) {
    const key = md5(param.url);
    const result = await this.cacheManager.get(key);
    try {
      if (!result) {
        const urlConvert = decrypt(atob(param.url), this.key);
        const urlParse = urlConvert.split('|');
        const m3u8 = urlParse[0];
        const referer = urlParse[1];
        const response = await this.httpService
          .get(m3u8, {
            headers: {
              Referer: referer,
            },
            timeout: 3000,
          })
          .toPromise();
        const data = this.mapFileM3u8(response.data, m3u8, referer);
        await this.cacheManager.set(key, data, 86400);
        return data;
      }
      return result;
    } catch (e) {
      console.log(e);
    }
    throw new BadRequestException('not found');
  }

  @Get('ts/:url')
  async getMovieSegment(@Param() param, @Request() req, @Response() res: Res) {
    const urlConvert = decrypt(atob(param.url), this.key);
    const urlParse = urlConvert.split('|');
    const segment = urlParse[0];
    const referer = urlParse[1];

    const uri = new URL(segment);

    const options = {
      hostname: uri.hostname,
      port: uri.port,
      path: uri.pathname + uri.search,
      method: req.method,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
        Referer: referer,
      },
      timeout: 3000,
    };

    const proxy = https.request(options, (r) => {
      r.headers['content-type'] = 'video/mp2t';
      res.writeHead(r.statusCode ?? 200, r.headers);

      r.pipe(res, {
        end: true,
      });
    });
    req.pipe(proxy, {
      end: true,
    });
    proxy.on('error', function (err) {
      throw new BadRequestException('not found');
    });
    proxy.end();
  }

  mapFileM3u8(data, url, referer) {
    const m3u8 = data;
    if (m3u8.includes('RESOLUTION=')) {
      const lines = m3u8.split('\n').filter((a) => a);
      const newLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('#')) {
          if (line.startsWith('#EXT-X-KEY:')) {
            const regex = /https?:\/\/[^\""\s]+/g;
            let urlParse = line.replace(regex, regex.exec(line)?.[0] ?? '');
            urlParse =
              '/movie/key/' + btoa(encrypt(`${urlParse}|${referer}`, this.key));
            newLines.push(urlParse);
          } else {
            newLines.push(line);
          }
        } else {
          const uri = new URL(line, url);
          const link =
            '/movie/' + btoa(encrypt(`${uri.href}|${referer}`, this.key));
          newLines.push(link);
        }
      }
      return newLines.join('\n');
    } else {
      const lines = m3u8.split('\n').filter((a) => a);
      const newLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('#')) {
          if (line.startsWith('#EXT-X-KEY:')) {
            const regex = /https?:\/\/[^\""\s]+/g;
            let urlParse = line.replace(regex, regex.exec(line)?.[0] ?? '');
            urlParse =
              '/movie/key/' + btoa(encrypt(`${urlParse}|${referer}`, this.key));
            newLines.push(line.replace(regex, url));
          } else {
            newLines.push(line);
          }
        } else {
          const uri = new URL(line, url);
          const link =
            '/movie/ts/' + btoa(encrypt(`${uri.href}|${referer}`, this.key));
          newLines.push(link);
        }
      }
      return newLines.join('\n');
    }
  }
}
