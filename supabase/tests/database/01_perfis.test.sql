begin;
select plan(9);

select tests.criar_usuario('ana@x.com', 'Ana');
select tests.criar_usuario('bruno@x.com', 'Bruno');
select tests.criar_usuario('admin@x.com', 'Admin', true);

select is((select nome from profiles where email = 'ana@x.com'), 'Ana', 'trigger cria perfil com nome');
select is((select categoria from profiles where email = 'ana@x.com'), 'C', 'trigger copia categoria do metadata');

select tests.logar_como((select id from profiles where email = 'ana@x.com'));

update profiles set categoria = 'B' where email = 'ana@x.com';
select is((select categoria from profiles where email = 'ana@x.com'), 'B', 'categoria é editável pelo próprio jogador');

update profiles set is_admin = true, ativo = false where email = 'ana@x.com';
select is(
  (select is_admin::text || '/' || ativo::text from profiles where email = 'ana@x.com'),
  'false/true', 'jogador não altera is_admin nem ativo');

with u as (update profiles set nome = 'Hack' where email = 'bruno@x.com' returning 1)
select is((select count(*) from u), 0::bigint, 'não edita perfil de outro');

select tests.deslogar();
update profiles set ativo = false where email = 'bruno@x.com';

select tests.logar_como((select id from profiles where email = 'ana@x.com'));
select is((select count(*) from profiles where email = 'bruno@x.com'), 0::bigint, 'desativado some para jogador');

select tests.logar_como((select id from profiles where email = 'admin@x.com'));
select is((select count(*) from profiles where email = 'bruno@x.com'), 1::bigint, 'admin vê desativado');
select tests.deslogar();

select is(hoje(), (now() at time zone 'America/Sao_Paulo')::date, 'hoje() usa fuso de São Paulo');

select throws_ok($$update profiles set forehand = 6 where email = 'ana@x.com'$$, '23514');

select * from finish();
rollback;
