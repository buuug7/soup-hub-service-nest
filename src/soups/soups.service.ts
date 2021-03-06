import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Soup } from './soup.entity';
import { PaginationParam, simplePagination } from '../common/pagination';
import { createQueryBuilder } from 'typeorm';
import { User } from '../users/user.entity';
import { CommentForm } from '../comments/comments.interface';
import { CommentsService } from '../comments/comments.service';

@Injectable()
export class SoupsService {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Get the specified resource
   * @param id
   */
  async getOne(id) {
    return await Soup.findOneOrFail(id, { relations: ['user'] });
  }

  /**
   * create soup
   * @param data
   */
  async create(data) {
    return await Soup.save(
      Soup.create({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  /**
   * update soup
   * @param id
   * @param data
   */
  async update(id, data) {
    const soup = await Soup.findOneOrFail(id);
    await Soup.merge(soup, {
      ...data,
      updatedAt: new Date(),
    }).save();

    return await this.getOne(id);
  }

  /**
   * Remove soup
   * @param id
   */
  async delete(id: number) {
    const instance = await Soup.findOneOrFail(id);
    return await instance.remove();
  }

  /**
   * list soup or search
   */
  async list(queryParam: PaginationParam) {
    // TODO: add starCount
    const query = createQueryBuilder(Soup)
      .addSelect(qb => {
        return qb
          .select('count(*)')
          .from('user_soup_star', 'UserSoupStar')
          .where('UserSoupStar.soupId = Soup.id');
      }, 'myCount')
      .leftJoinAndSelect('Soup.user', 'User');

    if (queryParam.content) {
      query.andWhere('Soup.content like :content', {
        content: `%${queryParam.content}%`,
      });
    }

    if (queryParam.createdAt) {
      const createdAtQuery = queryParam.createdAt;

      if (createdAtQuery.length === 2) {
        query.andWhere(`Soup.createdAt ${createdAtQuery[0]} :createdAt`, {
          createdAt: createdAtQuery[1],
        });
      }
    }

    if (queryParam.username) {
      query.andWhere('User.name = :name', {
        name: queryParam.username,
      });
    }

    return await simplePagination(query, queryParam);
  }

  /**
   * return the star count of the soup
   */
  async starCount(soupId): Promise<number> {
    return await createQueryBuilder()
      .select()
      .from('user_soup_star', 'UserSoupStar')
      .where('UserSoupStar.soupId = :soupId', {
        soupId: soupId,
      })
      .getCount();
  }

  /**
   * determine the soup whether is stared by give user
   * @param soupId
   * @param userId
   */
  async isStarByUser(soupId, userId): Promise<boolean> {
    const count = await createQueryBuilder()
      .select()
      .from('user_soup_star', 'UserSoupStar')
      .where(
        'UserSoupStar.userId = :userId AND UserSoupStar.soupId = :soupId',
        {
          userId: userId,
          soupId: soupId,
        },
      )
      .getCount();

    return count > 0;
  }

  /**
   * star soup with request soupId and user
   * @param soupId
   * @param userId
   * @return the star count
   */
  async star(soupId, userId): Promise<number> {
    const isStar = await this.isStarByUser(soupId, userId);

    if (isStar) {
      throw new HttpException(
        'the resource is already star by current user',
        HttpStatus.FORBIDDEN,
      );
    }

    await createQueryBuilder()
      .insert()
      .into('user_soup_star')
      .values([
        {
          userId: userId,
          soupId: soupId,
        },
      ])
      .execute();

    return this.starCount(soupId);
  }

  /**
   * unStar soup with request soupId and user
   * @param soupId
   * @param userId
   * @return the star count
   */
  async unStar(soupId, userId): Promise<number> {
    await createQueryBuilder()
      .delete()
      .from('user_soup_star')
      .where('userId = :userId AND soupId = :soupId', {
        userId: userId,
        soupId: soupId,
      })
      .execute();

    return this.starCount(soupId);
  }

  /**
   * toggle star
   * if already star and unStar, otherwise star
   * @param soupId
   * @param userId
   */
  async toggleStar(soupId, userId): Promise<number> {
    const isStar = await this.isStarByUser(soupId, userId);

    isStar
      ? await this.unStar(soupId, userId)
      : await this.star(soupId, userId);

    return await this.starCount(soupId);
  }

  /**
   * create soup comment
   * @param soupId
   * @param commentForm
   * @param user
   */
  async createComment(soupId: number, commentForm: CommentForm, user) {
    return await this.commentsService.create({
      commentForm,
      commentType: Soup.commentType,
      commentTypeId: soupId,
      user,
    });
  }

  /**
   * get soup comments
   * @param soupId
   * @param queryParam
   */
  async getComments(soupId, queryParam) {
    return await this.commentsService.getCommentsByTypeAndTypeId(
      Soup.commentType,
      soupId,
      queryParam,
    );
  }

  async getCommentsCountBySoupId(soupId) {
    return await this.commentsService.getCommentsCountByCommentTypeAndCommentTypeId(
      Soup.commentType,
      soupId,
    );
  }
}
